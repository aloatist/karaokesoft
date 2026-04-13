import http from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

const port = Number(process.env.PORT || 8787)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY || ''
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const SEARCH_RATE_WINDOW_MS = 10 * 60 * 1000
const SEARCH_RATE_LIMIT = Number(process.env.YOUTUBE_SEARCH_RATE_LIMIT || 120)
const searchRateLimits = new Map()

function writeJson(req, res, status, payload) {
  const origin = req.headers.origin || '*'
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  })
  res.end(JSON.stringify(payload))
}

function getRateKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
}

function allowSearchRequest(req) {
  const key = getRateKey(req)
  const now = Date.now()
  const current = searchRateLimits.get(key)

  if (!current || now - current.startedAt > SEARCH_RATE_WINDOW_MS) {
    searchRateLimits.set(key, { startedAt: now, count: 1 })
    return true
  }

  current.count += 1
  return current.count <= SEARCH_RATE_LIMIT
}

function getThumbnailUrl(item) {
  return item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url || ''
}

async function fetchVideoDetails(videoIds) {
  if (!videoIds.length) return new Map()

  const params = new URLSearchParams({
    key: YOUTUBE_API_KEY,
    id: videoIds.join(','),
    part: 'contentDetails,status',
    maxResults: String(videoIds.length),
  })

  const response = await fetch(`${YOUTUBE_BASE_URL}/videos?${params}`)
  if (!response.ok) return new Map()
  const json = await response.json()
  const items = Array.isArray(json.items) ? json.items : []
  return new Map(items.map((item) => [item.id, item]))
}

async function handleYoutubeSearch(req, res, url) {
  if (!YOUTUBE_API_KEY) {
    writeJson(req, res, 500, { ok: false, message: 'Server chưa cấu hình YOUTUBE_API_KEY.' })
    return
  }

  if (!allowSearchRequest(req)) {
    writeJson(req, res, 429, { ok: false, message: 'Tìm kiếm quá nhanh, vui lòng thử lại sau.' })
    return
  }

  const rawQuery = String(url.searchParams.get('q') || '').trim()
  if (rawQuery.length < 2) {
    writeJson(req, res, 400, { ok: false, message: 'Từ khoá tìm kiếm quá ngắn.' })
    return
  }

  const karaokeFilterEnabled = url.searchParams.get('karaoke') !== '0'
  const language = String(url.searchParams.get('language') || 'vi').replace(/[^a-z-]/gi, '').slice(0, 8) || 'vi'
  const maxResults = Math.max(1, Math.min(Number(url.searchParams.get('maxResults') || 12), 25))
  const q = karaokeFilterEnabled ? `${rawQuery} karaoke` : rawQuery

  const params = new URLSearchParams({
    key: YOUTUBE_API_KEY,
    q,
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: String(maxResults),
    safeSearch: 'strict',
    relevanceLanguage: language,
  })

  const response = await fetch(`${YOUTUBE_BASE_URL}/search?${params}`)
  if (response.status === 403) {
    writeJson(req, res, 403, { ok: false, message: 'API_QUOTA_EXCEEDED' })
    return
  }

  if (!response.ok) {
    writeJson(req, res, response.status, { ok: false, message: `Lỗi YouTube API: ${response.status}` })
    return
  }

  const json = await response.json()
  const rawItems = Array.isArray(json.items) ? json.items : []
  const detailsById = await fetchVideoDetails(rawItems.map((item) => item?.id?.videoId).filter(Boolean))
  const items = rawItems
    .map((item) => {
      const videoId = item?.id?.videoId
      if (!videoId) return null
      const details = detailsById.get(videoId)
      return {
        videoId,
        title: item?.snippet?.title || '(Không có tiêu đề)',
        channelTitle: item?.snippet?.channelTitle || '(Không rõ kênh)',
        thumbnail: getThumbnailUrl(item),
        duration: details?.contentDetails?.duration,
        embeddable: details?.status?.embeddable,
      }
    })
    .filter(Boolean)

  writeJson(req, res, 200, { ok: true, items })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')

  if (req.method === 'OPTIONS') {
    writeJson(req, res, 204, {})
    return
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    writeJson(req, res, 200, { ok: true, service: 'karaokeyt-remote-relay' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/youtube/search') {
    handleYoutubeSearch(req, res, url).catch((error) => {
      writeJson(req, res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : 'Không tìm kiếm được YouTube.',
      })
    })
    return
  }

  writeJson(req, res, 404, { ok: false, message: 'Not found' })
})

const wss = new WebSocketServer({ server })

const rooms = new Map()
const peers = new Map()

function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

function getRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode)
  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      hosts: new Set(),
      remotes: new Set(),
      displays: new Set(),
      latestState: null,
      token: '',
    })
  }
  return rooms.get(normalized)
}

function normalizeRoomToken(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64)
}

function getPresence(room) {
  return {
    hosts: room.hosts.size,
    remotes: room.remotes.size,
    displays: room.displays.size,
  }
}

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

function broadcastPresence(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return
  const payload = {
    type: 'ROOM_PRESENCE',
    roomCode,
    presence: getPresence(room),
  }
  for (const peer of [...room.hosts, ...room.remotes, ...room.displays]) {
    send(peer, payload)
  }
}

function cleanupPeer(ws) {
  const meta = peers.get(ws)
  if (!meta) return

  const room = rooms.get(meta.roomCode)
  if (room) {
    room[meta.role === 'host' ? 'hosts' : meta.role === 'display' ? 'displays' : 'remotes'].delete(ws)

    if (room.hosts.size === 0 && room.remotes.size === 0 && room.displays.size === 0) {
      rooms.delete(meta.roomCode)
    } else {
      broadcastPresence(meta.roomCode)
    }
  }

  peers.delete(ws)
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let payload = null
    try {
      payload = JSON.parse(String(raw))
    } catch {
      send(ws, { type: 'ROOM_ERROR', message: 'Payload không hợp lệ' })
      return
    }

    if (!payload || typeof payload.type !== 'string') {
      send(ws, { type: 'ROOM_ERROR', message: 'Thiếu type của message' })
      return
    }

    if (payload.type === 'JOIN_ROOM') {
      const roomCode = normalizeRoomCode(payload.roomCode)
      if (!roomCode) {
        send(ws, { type: 'ROOM_ERROR', message: 'Mã phòng không hợp lệ' })
        return
      }

      const room = getRoom(roomCode)
      const role = payload.role === 'host' || payload.role === 'display' ? payload.role : 'remote'
      const roomToken = normalizeRoomToken(payload.roomToken)

      if (role === 'host' && roomToken && !room.token) {
        room.token = roomToken
      }

      if (room.token && roomToken && roomToken !== room.token) {
        send(ws, { type: 'ROOM_ERROR', roomCode, message: 'Token phòng không khớp. Hãy quét lại QR hoặc đổi mã TV mới.' })
        return
      }

      peers.set(ws, {
        roomCode,
        role,
        clientId: String(payload.clientId || ''),
        nickname: String(payload.nickname || ''),
      })
      room[role === 'host' ? 'hosts' : role === 'display' ? 'displays' : 'remotes'].add(ws)

      send(ws, {
        type: 'ROOM_JOINED',
        roomCode,
        role,
        presence: getPresence(room),
      })

      if (room.latestState) {
        send(ws, {
          type: 'ROOM_STATE',
          roomCode,
          state: room.latestState,
        })
      }

      broadcastPresence(roomCode)
      return
    }

    const meta = peers.get(ws)
    if (!meta) {
      send(ws, { type: 'ROOM_ERROR', message: 'Bạn chưa tham gia phòng' })
      return
    }

    if (payload.type === 'ROOM_STATE') {
      if (meta.role !== 'host') {
        send(ws, { type: 'ROOM_ERROR', roomCode: meta.roomCode, message: 'Chỉ host mới phát state của phòng' })
        return
      }

      const room = getRoom(meta.roomCode)
      room.latestState = payload.state

      for (const peer of [...room.remotes, ...room.displays]) {
        send(peer, {
          type: 'ROOM_STATE',
          roomCode: meta.roomCode,
          state: payload.state,
        })
      }
      return
    }

    if (payload.type === 'REMOTE_ACTION') {
      const room = getRoom(meta.roomCode)
      for (const host of room.hosts) {
        send(host, {
          type: 'REMOTE_ACTION',
          roomCode: meta.roomCode,
          action: payload.action,
        })
      }
      return
    }

    send(ws, { type: 'ROOM_ERROR', roomCode: meta.roomCode, message: 'Message không được hỗ trợ' })
  })

  ws.on('close', () => cleanupPeer(ws))
  ws.on('error', () => cleanupPeer(ws))
})

server.listen(port, () => {
  console.log(`karaokeyt-remote-relay listening on http://127.0.0.1:${port}`)
})
