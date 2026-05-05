import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const serverDirPath = path.dirname(fileURLToPath(import.meta.url))
const projectRootPath = path.resolve(serverDirPath, '..')
const envKeysLoadedFromFiles = new Set()

function requirePackage(packageName) {
  const requireCandidates = [
    createRequire(import.meta.url),
    process.resourcesPath ? createRequire(path.join(process.resourcesPath, 'app.asar', 'package.json')) : null,
    createRequire(path.join(projectRootPath, 'package.json')),
  ].filter(Boolean)

  let lastError = null
  for (const requireFrom of requireCandidates) {
    try {
      return requireFrom(packageName)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error(`Cannot find package ${packageName}`)
}

const { WebSocket, WebSocketServer } = requirePackage('ws')

function loadEnvFile(filePath, { overrideFileValues = false } = {}) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue

    const [, key, rawValue] = match
    const hasExistingValue = process.env[key] !== undefined
    if (hasExistingValue && (!overrideFileValues || !envKeysLoadedFromFiles.has(key))) continue

    const value = rawValue
      .replace(/\s+#.*$/, '')
      .replace(/^(['"])(.*)\1$/, '$2')
      .replace(/\\n/g, '\n')

    process.env[key] = value
    envKeysLoadedFromFiles.add(key)
  }
}

loadEnvFile(path.join(projectRootPath, '.env'))
loadEnvFile(path.join(projectRootPath, '.env.local'), { overrideFileValues: true })

const port = Number(process.env.PORT || process.env.RELAY_PORT || 8787)
const host = process.env.RELAY_HOST || '0.0.0.0'
const distRootPath = [
  process.env.KARAOKEYT_DIST_DIR,
  path.join(projectRootPath, 'dist'),
  process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', 'dist') : '',
  process.resourcesPath ? path.join(process.resourcesPath, 'dist') : '',
  path.join(process.cwd(), 'dist'),
].filter(Boolean).find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) || path.join(projectRootPath, 'dist')
const localMediaRootPath = process.env.KARAOKEYT_MEDIA_DIR || ''
const LOCAL_MEDIA_URL_PREFIX = '/local-media/'
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const SEARCH_RATE_WINDOW_MS = 10 * 60 * 1000
const SEARCH_RATE_LIMIT = Number(process.env.YOUTUBE_SEARCH_RATE_LIMIT || 120)
const SEARCH_CACHE_TTL_MS = Math.max(60_000, Number(process.env.YOUTUBE_SEARCH_CACHE_TTL_MS || 15 * 60 * 1000))
const SEARCH_STALE_CACHE_TTL_MS = Math.max(SEARCH_CACHE_TTL_MS, Number(process.env.YOUTUBE_SEARCH_STALE_CACHE_TTL_MS || 6 * 60 * 60 * 1000))
const SEARCH_CACHE_MAX_ENTRIES = Math.max(50, Number(process.env.YOUTUBE_SEARCH_CACHE_MAX_ENTRIES || 400))
const HEARTBEAT_INTERVAL_MS = Math.max(5_000, Number(process.env.RELAY_HEARTBEAT_INTERVAL_MS || 15_000))
const EXTENSION_BODY_LIMIT_BYTES = 32 * 1024
const searchRateLimits = new Map()
const youtubeSearchCache = new Map()
const rooms = new Map()
const peers = new Map()

function getYoutubeApiKeys() {
  const seen = new Set()
  const keys = []
  const rawValues = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEYS,
    process.env.YT_API_KEY,
    process.env.VITE_YT_API_KEY,
  ]

  for (const rawValue of rawValues) {
    for (const item of String(rawValue || '').split(/[\s,;]+/)) {
      const key = item.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }

  return keys
}

function writeJson(req, res, status, payload, extraHeaders = {}) {
  const origin = req.headers.origin || '*'
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-private-network': 'true',
    'cache-control': 'no-store',
    vary: 'Origin',
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req, maxBytes = EXTENSION_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        reject(new Error('Payload quá lớn.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('JSON không hợp lệ.'))
      }
    })
    req.on('error', reject)
  })
}

function normalizeSearchCachePart(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getSearchCacheKey({ query, karaokeFilterEnabled, language, maxResults }) {
  return [
    normalizeSearchCachePart(query),
    karaokeFilterEnabled ? 'karaoke' : 'all',
    normalizeSearchCachePart(language || 'vi'),
    String(maxResults),
  ].join('|')
}

function getSearchCacheEntry(cacheKey) {
  const entry = youtubeSearchCache.get(cacheKey)
  if (!entry) return null

  const ageMs = Date.now() - entry.createdAt
  if (ageMs > SEARCH_STALE_CACHE_TTL_MS) {
    youtubeSearchCache.delete(cacheKey)
    return null
  }

  return {
    ...entry,
    ageMs,
    fresh: ageMs <= SEARCH_CACHE_TTL_MS,
  }
}

function setSearchCacheEntry(cacheKey, items) {
  if (youtubeSearchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = youtubeSearchCache.keys().next().value
    if (oldestKey) youtubeSearchCache.delete(oldestKey)
  }

  youtubeSearchCache.set(cacheKey, {
    createdAt: Date.now(),
    items,
  })
}

function writeCachedSearch(req, res, cached, { stale = false, warning } = {}) {
  writeJson(req, res, 200, {
    ok: true,
    items: cached.items,
    cached: true,
    stale,
    cacheAgeMs: cached.ageMs,
    warning,
  }, {
    'x-karaokeyt-cache': stale ? 'stale' : 'hit',
  })
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

function getStaticContentType(extname) {
  switch (extname) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.m4v':
      return 'video/x-m4v'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

function serveLocalMedia(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeJson(req, res, 404, { ok: false, message: 'Not found' })
    return
  }

  if (!localMediaRootPath) {
    writeJson(req, res, 404, { ok: false, message: 'Local media is not configured' })
    return
  }

  const mediaRoot = path.resolve(localMediaRootPath)
  const pathname = decodeURIComponent(url.pathname || '')
  const safeFileName = path.basename(pathname.slice(LOCAL_MEDIA_URL_PREFIX.length))
  const requestedPath = path.resolve(mediaRoot, safeFileName)
  if (!safeFileName || (requestedPath !== mediaRoot && !requestedPath.startsWith(`${mediaRoot}${path.sep}`))) {
    writeJson(req, res, 404, { ok: false, message: 'Not found' })
    return
  }

  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    writeJson(req, res, 404, { ok: false, message: 'Not found' })
    return
  }

  res.writeHead(200, {
    'content-type': getStaticContentType(path.extname(requestedPath).toLowerCase()),
    'cache-control': 'public, max-age=31536000, immutable',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(requestedPath).pipe(res)
}

function serveStaticApp(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeJson(req, res, 404, { ok: false, message: 'Not found' })
    return
  }

  const pathname = decodeURIComponent(url.pathname || '/')
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const normalizedPath = path.normalize(relativePath)
  const requestedPath = path.join(distRootPath, normalizedPath)
  const safeRequestedPath = requestedPath.startsWith(distRootPath) ? requestedPath : path.join(distRootPath, 'index.html')
  const targetPath = fs.existsSync(safeRequestedPath) && fs.statSync(safeRequestedPath).isFile()
    ? safeRequestedPath
    : path.join(distRootPath, 'index.html')

  if (!fs.existsSync(targetPath)) {
    writeJson(req, res, 404, {
      ok: false,
      message: 'Chưa có dist để relay phục vụ remote web. Hãy chạy npm run build:web.',
    })
    return
  }

  const headers = {
    'content-type': getStaticContentType(path.extname(targetPath).toLowerCase()),
    'cache-control': targetPath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(targetPath).pipe(res)
}

async function fetchVideoDetails(videoIds, apiKey) {
  if (!videoIds.length) return new Map()
  if (!apiKey) return new Map()

  const params = new URLSearchParams({
    key: apiKey,
    id: videoIds.join(','),
    part: 'contentDetails,status',
    maxResults: String(videoIds.length),
    fields: 'items(id,contentDetails/duration,status/embeddable)',
  })

  const response = await fetch(`${YOUTUBE_BASE_URL}/videos?${params}`)
  if (!response.ok) return new Map()
  const json = await response.json()
  const items = Array.isArray(json.items) ? json.items : []
  return new Map(items.map((item) => [item.id, item]))
}

async function getYoutubeApiErrorMessage(response) {
  const json = await response.json().catch(() => null)
  const rawMessage = String(json?.error?.message || '').trim()
  const reason = String(json?.error?.errors?.[0]?.reason || '').trim()
  const normalized = `${rawMessage} ${reason}`.toLowerCase()

  if (normalized.includes('api key not valid') || normalized.includes('keyinvalid')) {
    return 'YouTube API key không hợp lệ. Hãy tạo key mới và bật YouTube Data API v3 trong Google Cloud.'
  }

  if (normalized.includes('quota') || normalized.includes('dailylimitexceeded')) {
    return 'API_QUOTA_EXCEEDED'
  }

  if (rawMessage) {
    return `Lỗi YouTube API: ${response.status} - ${rawMessage}`
  }

  return `Lỗi YouTube API: ${response.status}`
}

async function handleYoutubeSearch(req, res, url) {
  const rawQuery = String(url.searchParams.get('q') || '').trim()
  if (rawQuery.length < 2) {
    writeJson(req, res, 400, { ok: false, message: 'Từ khoá tìm kiếm quá ngắn.' })
    return
  }

  const karaokeFilterEnabled = url.searchParams.get('karaoke') !== '0'
  const language = String(url.searchParams.get('language') || 'vi').replace(/[^a-z-]/gi, '').slice(0, 8) || 'vi'
  const maxResults = Math.max(1, Math.min(Number(url.searchParams.get('maxResults') || 12), 25))
  const q = karaokeFilterEnabled ? `${rawQuery} karaoke` : rawQuery
  const cacheKey = getSearchCacheKey({ query: rawQuery, karaokeFilterEnabled, language, maxResults })
  const cached = getSearchCacheEntry(cacheKey)

  if (cached?.fresh) {
    writeCachedSearch(req, res, cached)
    return
  }

  const youtubeApiKeys = getYoutubeApiKeys()

  if (!youtubeApiKeys.length) {
    writeJson(req, res, 500, { ok: false, message: 'Server chưa cấu hình YOUTUBE_API_KEY.' })
    return
  }

  if (!allowSearchRequest(req)) {
    if (cached) {
      writeCachedSearch(req, res, cached, { stale: true, warning: 'Tìm kiếm quá nhanh, đang dùng kết quả đã lưu.' })
      return
    }
    writeJson(req, res, 429, { ok: false, message: 'Tìm kiếm quá nhanh, vui lòng thử lại sau.' })
    return
  }

  let response
  let activeYoutubeApiKey = ''
  let switchedBackupKey = false
  for (const [index, youtubeApiKey] of youtubeApiKeys.entries()) {
    const params = new URLSearchParams({
      key: youtubeApiKey,
      q,
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      videoCategoryId: '10',
      maxResults: String(maxResults),
      safeSearch: 'strict',
      relevanceLanguage: language,
      fields: 'items(id/videoId,snippet/title,snippet/channelTitle,snippet/thumbnails/default/url,snippet/thumbnails/medium/url)',
    })

    try {
      response = await fetch(`${YOUTUBE_BASE_URL}/search?${params}`)
    } catch (error) {
      if (cached) {
        writeCachedSearch(req, res, cached, { stale: true, warning: 'Không gọi được YouTube API, đang dùng kết quả đã lưu.' })
        return
      }
      throw error
    }

    if (response.status === 403) {
      const message = await getYoutubeApiErrorMessage(response)
      if (message === 'API_QUOTA_EXCEEDED' && index < youtubeApiKeys.length - 1) {
        switchedBackupKey = true
        continue
      }
      if (message === 'API_QUOTA_EXCEEDED' && cached) {
        writeCachedSearch(req, res, cached, { stale: true, warning: message })
        return
      }
      writeJson(req, res, 403, { ok: false, message })
      return
    }

    if (!response.ok) {
      const message = await getYoutubeApiErrorMessage(response)
      if (cached && response.status >= 500) {
        writeCachedSearch(req, res, cached, { stale: true, warning: message })
        return
      }
      writeJson(req, res, response.status, { ok: false, message })
      return
    }

    activeYoutubeApiKey = youtubeApiKey
    break
  }

  if (!response || !activeYoutubeApiKey) {
    writeJson(req, res, 403, { ok: false, message: 'API_QUOTA_EXCEEDED' })
    return
  }

  const json = await response.json()
  const rawItems = Array.isArray(json.items) ? json.items : []
  const detailsById = await fetchVideoDetails(
    rawItems.map((item) => item?.id?.videoId).filter(Boolean),
    activeYoutubeApiKey,
  )
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

  setSearchCacheEntry(cacheKey, items)
  writeJson(req, res, 200, {
    ok: true,
    items,
    warning: switchedBackupKey ? 'Key chính đã hết quota, đã chuyển sang key dự phòng.' : undefined,
    activeKeyIndex: youtubeApiKeys.indexOf(activeYoutubeApiKey),
  })
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces()
  const addresses = []

  for (const infos of Object.values(interfaces)) {
    if (!infos) continue
    for (const info of infos) {
      if (info.internal) continue
      if (info.family !== 'IPv4') continue
      addresses.push({
        address: info.address,
        family: info.family,
        url: `http://${info.address}:${port}`,
      })
    }
  }

  return addresses
}

function getRequestProtocol(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  if (forwardedProto === 'https') return 'https'
  return 'http'
}

function getRequestHost(req) {
  return String(req.headers.host || `127.0.0.1:${port}`).trim()
}

function getRequestBaseUrl(req) {
  return `${getRequestProtocol(req)}://${getRequestHost(req)}`
}

function getRequestRelayUrl(req) {
  const protocol = getRequestProtocol(req) === 'https' ? 'wss' : 'ws'
  return `${protocol}://${getRequestHost(req)}/`
}

function getLatestActiveRoomCode() {
  let selectedRoomCode = ''
  let selectedUpdatedAt = 0

  for (const [roomCode, room] of rooms.entries()) {
    if (room.hosts.size <= 0) continue
    const updatedAt = Number(room.updatedAt || room.createdAt || 0)
    if (updatedAt >= selectedUpdatedAt) {
      selectedRoomCode = roomCode
      selectedUpdatedAt = updatedAt
    }
  }

  return selectedRoomCode
}

function writeTvDisplayWaitingPage(req, res) {
  const baseUrl = getRequestBaseUrl(req)
  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="3">
  <title>KaraokeYT TV Display</title>
  <style>
    body{margin:0;min-height:100vh;background:#09090d;color:#f7efe9;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center}
    main{max-width:760px;padding:36px;text-align:center}
    h1{font-size:clamp(34px,6vw,64px);line-height:1;margin:0 0 18px}
    p{font-size:clamp(18px,3vw,26px);line-height:1.45;color:#c9c0cd;margin:0}
    code{display:inline-block;margin-top:22px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.08);color:#ffd4b9}
  </style>
</head>
<body>
  <main>
    <h1>Chờ phòng KaraokeYT</h1>
    <p>Hãy mở app điều khiển trên laptop hoặc điện thoại trước, rồi giữ TV ở trang này.</p>
    <code>${baseUrl}/tv</code>
  </main>
</body>
</html>`

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(html)
}

function handleTvDisplayRedirect(req, res, url) {
  const match = url.pathname.match(/^\/tv(?:\/([A-Za-z0-9]{1,12}))?\/?$/)
  if (!match) return false

  const roomCode = normalizeRoomCode(match[1] || url.searchParams.get('room') || getLatestActiveRoomCode())
  if (!roomCode) {
    writeTvDisplayWaitingPage(req, res)
    return true
  }

  const room = rooms.get(roomCode)
  const roomToken = normalizeRoomToken(url.searchParams.get('token') || room?.token || '')
  const targetUrl = new URL('/', getRequestBaseUrl(req))
  targetUrl.searchParams.set('screen', 'display')
  targetUrl.searchParams.set('room', roomCode)
  if (roomToken) {
    targetUrl.searchParams.set('token', roomToken)
  }
  targetUrl.searchParams.set('displayTarget', 'tv')
  targetUrl.searchParams.set('relay', getRequestRelayUrl(req))

  res.writeHead(302, {
    location: targetUrl.toString(),
    'cache-control': 'no-store',
  })
  res.end()
  return true
}

function cleanExtensionText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function normalizeExtensionAction(value) {
  return value === 'play-now' || value === 'add-next' || value === 'add-end' ? value : 'add-end'
}

function normalizeExtensionPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const videoId = cleanExtensionText(source.videoId, 32).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
  const url = cleanExtensionText(source.url, 2000)

  if (!videoId && !url) return null

  return {
    action: normalizeExtensionAction(source.action),
    requestId: cleanExtensionText(source.requestId, 120) || `relay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    url,
    videoId,
    title: cleanExtensionText(source.title, 180),
    channelTitle: cleanExtensionText(source.channelTitle, 120) || 'Từ Chrome extension',
    thumbnail: cleanExtensionText(source.thumbnail, 500),
  }
}

async function handleExtensionYoutubeAction(req, res, url) {
  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    writeJson(req, res, 400, {
      ok: false,
      message: error instanceof Error ? error.message : 'Không đọc được dữ liệu extension.',
    })
    return
  }

  const payload = normalizeExtensionPayload(body?.payload || body)
  if (!payload) {
    writeJson(req, res, 400, {
      ok: false,
      message: 'Thiếu link hoặc mã video YouTube.',
    })
    return
  }

  const roomCode = normalizeRoomCode(body?.roomCode || url.searchParams.get('room') || getLatestActiveRoomCode())
  const room = roomCode ? rooms.get(roomCode) : null
  if (!room || room.hosts.size <= 0) {
    writeJson(req, res, 409, {
      ok: false,
      message: 'Chưa thấy app KaraokeYT đang chạy. Hãy mở app laptop trước rồi thử lại.',
    })
    return
  }

  const action = {
    type: 'ADD_YOUTUBE',
    payload,
  }

  for (const hostSocket of room.hosts) {
    send(hostSocket, {
      type: 'REMOTE_ACTION',
      roomCode,
      action,
    })
  }
  room.updatedAt = Date.now()

  writeJson(req, res, 200, {
    ok: true,
    roomCode,
    hosts: room.hosts.size,
    message: 'Đã gửi bài vào app KaraokeYT.',
  })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')

  if (req.method === 'OPTIONS') {
    writeJson(req, res, 204, {})
    return
  }

  if (url.pathname.startsWith(LOCAL_MEDIA_URL_PREFIX)) {
    serveLocalMedia(req, res, url)
    return
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && handleTvDisplayRedirect(req, res, url)) {
    return
  }

  if (url.pathname === '/health') {
    writeJson(req, res, 200, { ok: true, service: 'karaokeyt-remote-relay' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/network-info') {
    writeJson(req, res, 200, {
      ok: true,
      service: 'karaokeyt-remote-relay',
      port,
      addresses: getLanAddresses(),
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/extension/status') {
    writeJson(req, res, 200, {
      ok: true,
      service: 'karaokeyt-remote-relay',
      port,
      latestActiveRoomCode: getLatestActiveRoomCode(),
      rooms: getRoomsSnapshot(),
    })
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

  if (req.method === 'POST' && url.pathname === '/api/extension/youtube-action') {
    handleExtensionYoutubeAction(req, res, url).catch((error) => {
      writeJson(req, res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : 'Không gửi được bài từ Chrome extension.',
      })
    })
    return
  }

  serveStaticApp(req, res, url)
})

const wss = new WebSocketServer({ server })

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
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

function getRoomsSnapshot() {
  return [...rooms.entries()]
    .map(([roomCode, room]) => ({
      roomCode,
      ...getPresence(room),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
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
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })

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

      cleanupPeer(ws)

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
      room.updatedAt = Date.now()

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
      room.updatedAt = Date.now()

      for (const peer of [...room.hosts, ...room.remotes, ...room.displays]) {
        if (peer === ws) continue
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

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== WebSocket.OPEN) {
      continue
    }

    if (ws.isAlive === false) {
      cleanupPeer(ws)
      ws.terminate()
      continue
    }

    ws.isAlive = false
    ws.ping()
  }
}, HEARTBEAT_INTERVAL_MS)

wss.on('close', () => {
  clearInterval(heartbeatTimer)
})

server.on('error', (error) => {
  console.error(`karaokeyt-remote-relay error: ${error.message}`)
})

server.listen(port, host, () => {
  console.log(`karaokeyt-remote-relay listening on http://${host}:${port}`)
})
