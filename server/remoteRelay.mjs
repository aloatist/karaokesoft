import http from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

const port = Number(process.env.PORT || 8787)

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'karaokeyt-remote-relay' }))
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: false, message: 'Not found' }))
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
    })
  }
  return rooms.get(normalized)
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
