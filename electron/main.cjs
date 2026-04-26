const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron')
const { SecureStorage } = require('./secureStorage.cjs')
const { setupAutoUpdate } = require('./autoUpdate.cjs')

const preloadPath = path.join(__dirname, 'preload.cjs')
const distRootPath = path.join(__dirname, '..', 'dist')
const devServerUrl = process.env.VITE_DEV_SERVER_URL

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let controlWindow = null
let displayWindow = null
let youtubeWindow = null
let youtubeLoginWindow = null
let rendererServer = null
let rendererBaseUrl = null
let remoteRelayStarted = false
let activeRelayPort = Number(process.env.PORT || process.env.RELAY_PORT || '8787')
let dangXuLyLoiNghiemTrong = false
const secureStorage = new SecureStorage()
const LOCAL_MEDIA_URL_PREFIX = '/local-media/'
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const IMAGE_MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const VIDEO_MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v'])
const LOCAL_MEDIA_EXTENSIONS = new Set([...IMAGE_MEDIA_EXTENSIONS, ...VIDEO_MEDIA_EXTENSIONS])

function taoUserAgent() {
  return (app.userAgentFallback || '').replace(/\sElectron\/[\d.]+/, '')
}

function looksLikeYoutubeApiKey(value) {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(String(value || '').trim())
}

function layYoutubeApiKey() {
  const serverKey = process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY || ''
  const devClientKey = process.env.VITE_YT_API_KEY || ''

  if (looksLikeYoutubeApiKey(serverKey)) return serverKey.trim()
  if (looksLikeYoutubeApiKey(devClientKey)) return devClientKey.trim()
  return String(serverKey || devClientKey || '').trim()
}

function vietJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

async function layMessageLoiYoutube(response) {
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

function layThumbnailYoutube(item) {
  return item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url || ''
}

async function layChiTietVideoYoutube(videoIds, apiKey) {
  if (!videoIds.length || !apiKey) return new Map()

  const params = new URLSearchParams({
    key: apiKey,
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

async function phucVuYoutubeSearchNoiBo(_req, res, reqUrl) {
  const youtubeApiKey = layYoutubeApiKey()

  if (!youtubeApiKey) {
    vietJson(res, 500, { ok: false, message: 'Server chưa cấu hình YOUTUBE_API_KEY.' })
    return
  }

  const rawQuery = String(reqUrl.searchParams.get('q') || '').trim()
  if (rawQuery.length < 2) {
    vietJson(res, 400, { ok: false, message: 'Từ khoá tìm kiếm quá ngắn.' })
    return
  }

  const karaokeFilterEnabled = reqUrl.searchParams.get('karaoke') !== '0'
  const language = String(reqUrl.searchParams.get('language') || 'vi').replace(/[^a-z-]/gi, '').slice(0, 8) || 'vi'
  const maxResults = Math.max(1, Math.min(Number(reqUrl.searchParams.get('maxResults') || 12), 25))
  const q = karaokeFilterEnabled ? `${rawQuery} karaoke` : rawQuery

  const params = new URLSearchParams({
    key: youtubeApiKey,
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
    vietJson(res, 403, { ok: false, message: await layMessageLoiYoutube(response) })
    return
  }

  if (!response.ok) {
    vietJson(res, response.status, { ok: false, message: await layMessageLoiYoutube(response) })
    return
  }

  const json = await response.json()
  const rawItems = Array.isArray(json.items) ? json.items : []
  const detailsById = await layChiTietVideoYoutube(
    rawItems.map((item) => item?.id?.videoId).filter(Boolean),
    youtubeApiKey,
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
        thumbnail: layThumbnailYoutube(item),
        duration: details?.contentDetails?.duration,
        embeddable: details?.status?.embeddable,
      }
    })
    .filter(Boolean)

  vietJson(res, 200, { ok: true, items })
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ghiLogSuCo(nhan, error) {
  const stack = error instanceof Error ? error.stack || error.message : String(error)
  const message = `[${new Date().toISOString()}] ${nhan}\n${stack}\n\n`
  console.error(nhan, error)

  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.appendFileSync(path.join(app.getPath('userData'), 'desktop-startup.log'), message, 'utf8')
  } catch {}
}

function taoTrangLoiHtml(title, message, detail) {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b0b10;
        color: #f6ecff;
        display: grid;
        place-items: center;
      }
      .wrap {
        width: min(880px, calc(100vw - 32px));
        background: #171520;
        border: 1px solid rgba(255, 140, 92, 0.28);
        border-radius: 8px;
        padding: 24px;
        box-sizing: border-box;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0 0 12px;
        font-size: 16px;
        color: #d8cce6;
      }
      pre {
        margin: 16px 0 0;
        padding: 16px;
        background: rgba(0, 0, 0, 0.28);
        border-radius: 8px;
        white-space: pre-wrap;
        word-break: break-word;
        overflow: auto;
        color: #ffcfb8;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <pre>${escapeHtml(detail)}</pre>
    </div>
  </body>
</html>`
}

async function taiTrangLoi(windowRef, title, message, detail) {
  if (!windowRef || windowRef.isDestroyed()) return
  await windowRef.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(taoTrangLoiHtml(title, message, detail))}`)
  windowRef.show()
  windowRef.focus()
}

async function baoLoiNghiemTrong(error, nhan = 'Lỗi desktop') {
  if (dangXuLyLoiNghiemTrong) return
  dangXuLyLoiNghiemTrong = true

  const detail = error instanceof Error ? error.stack || error.message : String(error)
  ghiLogSuCo(nhan, error)

  try {
    if (!app.isReady()) {
      console.error(detail)
      return
    }

    if (!controlWindow || controlWindow.isDestroyed()) {
      controlWindow = new BrowserWindow({
        title: 'KaraokeYT',
        width: 980,
        height: 760,
        minWidth: 760,
        minHeight: 540,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#0b0b10',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      })
    }

    await taiTrangLoi(
      controlWindow,
      'KaraokeYT không khởi động được',
      'Ứng dụng đã gặp lỗi khi mở desktop. Màn hình này được giữ lại để bạn không bị trắng rồi tự tắt.',
      detail,
    )
    dialog.showErrorBox('KaraokeYT desktop lỗi khởi động', detail.slice(0, 3000))
  } catch (displayError) {
    console.error('Không hiển thị được màn lỗi desktop:', displayError)
  }
}

function ganTheoDoiCuaSo(name, targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return

  targetWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    if (code === -3) return
    ghiLogSuCo(`[${name}] did-fail-load ${code} ${description} ${validatedURL}`, new Error(description))
    void taiTrangLoi(
      targetWindow,
      'Không tải được giao diện KaraokeYT',
      'Ứng dụng không tải được giao diện điều khiển. Hãy gửi nội dung lỗi này để kiểm tra bản Windows.',
      `${code} ${description}\n${validatedURL}`,
    )
  })

  targetWindow.webContents.on('render-process-gone', (_event, details) => {
    ghiLogSuCo(`[${name}] render-process-gone`, new Error(JSON.stringify(details)))
  })

  targetWindow.on('unresponsive', () => {
    ghiLogSuCo(`[${name}] unresponsive`, new Error('Window unresponsive'))
  })
}

function layContentType(extname) {
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

function layThuMucMediaLocal() {
  return path.join(app.getPath('userData'), 'local-media')
}

function damBaoThuMucMediaLocal() {
  const mediaDir = layThuMucMediaLocal()
  fs.mkdirSync(mediaDir, { recursive: true })
  return mediaDir
}

function layLoaiMediaTheoExt(extname) {
  if (IMAGE_MEDIA_EXTENSIONS.has(extname)) return 'image'
  if (VIDEO_MEDIA_EXTENSIONS.has(extname)) return 'video'
  return null
}

function taoTenFileMedia(extname) {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extname}`
}

function taoUrlMediaLocal(fileName) {
  const safeFileName = path.basename(fileName)
  return `${LOCAL_MEDIA_URL_PREFIX}${encodeURIComponent(safeFileName)}`
}

function layDuongDanMediaLocalTuPathname(pathname) {
  if (!pathname.startsWith(LOCAL_MEDIA_URL_PREFIX)) return null

  const mediaDir = damBaoThuMucMediaLocal()
  const mediaDirResolved = path.resolve(mediaDir)
  const rawFileName = pathname.slice(LOCAL_MEDIA_URL_PREFIX.length)
  const safeFileName = path.basename(rawFileName)
  if (!safeFileName) return null

  const filePath = path.resolve(mediaDirResolved, safeFileName)
  if (filePath !== mediaDirResolved && !filePath.startsWith(`${mediaDirResolved}${path.sep}`)) return null
  return filePath
}

function phucVuMediaLocal(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Không tìm thấy media.')
    return
  }

  const targetPath = layDuongDanMediaLocalTuPathname(pathname)
  if (!targetPath || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Không tìm thấy media.')
    return
  }

  res.writeHead(200, {
    'Content-Type': layContentType(path.extname(targetPath).toLowerCase()),
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(targetPath).pipe(res)
}

function layDiaChiLan() {
  const interfaces = os.networkInterfaces()
  const addresses = []

  for (const infos of Object.values(interfaces)) {
    if (!infos) continue
    for (const info of infos) {
      if (info.internal || info.family !== 'IPv4') continue
      if (!info.address || info.address.startsWith('169.254.')) continue
      addresses.push({
        address: info.address,
        family: info.family,
      })
    }
  }

  return addresses
}

async function batMayChuRenderer() {
  if (devServerUrl) {
    rendererBaseUrl = devServerUrl
    return rendererBaseUrl
  }

  if (rendererBaseUrl) {
    return rendererBaseUrl
  }

  const rendererDistRootPath = layDistRootPathChoRelay()
  const rendererIndexPath = path.join(rendererDistRootPath, 'index.html')

  if (!fs.existsSync(rendererIndexPath)) {
    throw new Error(`Không tìm thấy renderer bundle. Đã thử: ${rendererDistRootPath}`)
  }

  rendererServer = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(reqUrl.pathname)
    if (pathname === '/api/youtube/search' && req.method === 'GET') {
      phucVuYoutubeSearchNoiBo(req, res, reqUrl).catch((error) => {
        vietJson(res, 500, {
          ok: false,
          message: error instanceof Error ? error.message : 'Không tìm kiếm được YouTube.',
        })
      })
      return
    }
    if (pathname.startsWith(LOCAL_MEDIA_URL_PREFIX)) {
      phucVuMediaLocal(req, res, pathname)
      return
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const normalizedPath = path.normalize(relativePath)
    const filePath = path.join(rendererDistRootPath, normalizedPath)
    const namTrongDist = filePath.startsWith(rendererDistRootPath)
    const targetPath = namTrongDist && fs.existsSync(filePath) ? filePath : rendererIndexPath

    fs.readFile(targetPath, (error, data) => {
      if (error) {
        console.warn('[Renderer] Không đọc được file:', targetPath, error)
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Không đọc được renderer bundle.')
        return
      }

      res.writeHead(200, {
        'Content-Type': layContentType(path.extname(targetPath).toLowerCase()),
        'Cache-Control': targetPath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
      res.end(data)
    })
  })

  await new Promise((resolve, reject) => {
    rendererServer.once('error', reject)
    rendererServer.listen(0, '127.0.0.1', () => {
      resolve()
    })
  })

  const address = rendererServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Không xác định được cổng renderer local server.')
  }

  rendererBaseUrl = `http://127.0.0.1:${address.port}`
  return rendererBaseUrl
}

function kiemTraRelayUrl(healthUrl) {
  return new Promise((resolve) => {
    const req = http.get(healthUrl, { timeout: 1200 }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        let payload = null
        try {
          payload = JSON.parse(body)
        } catch {}
        resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500 && payload?.service === 'karaokeyt-remote-relay'))
      })
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

function kiemTraRelayLocal(port = activeRelayPort) {
  return kiemTraRelayUrl(`http://127.0.0.1:${port}/health`)
}

async function kiemTraRelayLan(port = activeRelayPort) {
  for (const item of layDiaChiLan()) {
    if (await kiemTraRelayUrl(`http://${item.address}:${port}/health`)) {
      return true
    }
  }
  return false
}

function congRelayKhaDung(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => {
      probe.close(() => resolve(true))
    })
    probe.listen(port, '0.0.0.0')
  })
}

async function timCongRelayKhaDung() {
  const preferredPort = Number(process.env.PORT || process.env.RELAY_PORT || activeRelayPort || 8787)
  const candidates = [preferredPort, 8787, 8790, 8791, 8792, 8793, 8794, 8795, 8796, 8797, 8798, 8799]
    .filter((port, index, array) => Number.isFinite(port) && port > 0 && array.indexOf(port) === index)

  for (const port of candidates) {
    if (await congRelayKhaDung(port)) return port
  }

  return preferredPort
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function doiRelayLocalSanSang(timeoutMs = 4000, port = activeRelayPort) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await kiemTraRelayLocal(port)) return true
    await delay(200)
  }
  return false
}

function layThongTinMangDesktop() {
  const relayPort = activeRelayPort || Number(process.env.PORT || process.env.RELAY_PORT || '8787')
  let rendererPort = 0
  let rendererProtocol = 'http:'

  try {
    const url = new URL(rendererBaseUrl || devServerUrl || 'http://127.0.0.1:5173/')
    rendererPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
    rendererProtocol = url.protocol
  } catch {
    rendererPort = 5173
  }

  const relayProtocol = rendererProtocol === 'https:' ? 'wss' : 'ws'
  const httpProtocol = rendererProtocol === 'https:' ? 'https' : 'http'

  return {
    ok: true,
    rendererBaseUrl: rendererBaseUrl || devServerUrl || '',
    rendererPort,
    relayPort,
    addresses: layDiaChiLan().map((item) => ({
      ...item,
      url: `${httpProtocol}://${item.address}:${relayPort}/`,
      rendererUrl: `${httpProtocol}://${item.address}:${rendererPort}/`,
      relayUrl: `${relayProtocol}://${item.address}:${relayPort}/`,
    })),
  }
}

async function initSecureStorage() {
  await secureStorage.init()
  
  // Try to get API key from secure storage
  const apiKey = await secureStorage.getApiKey()
  if (apiKey) {
    console.log('[Main] YouTube API Key loaded from secure storage')
  }
}

function docConfigMayChu() {
  // Legacy: Read config from outside asar in userData folder or app directory
  const possiblePaths = [
    path.join(app.getPath('userData'), 'karaokeyt-config.json'),
    path.join(path.dirname(app.getPath('exe')), 'karaokeyt-config.json'),
    path.join(__dirname, '..', '..', 'karaokeyt-config.json'), // dev mode
  ]
  
  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (config.YOUTUBE_API_KEY && !process.env.YOUTUBE_API_KEY) {
          // Migrate to secure storage and delete plaintext file
          secureStorage
            .saveApiKey(config.YOUTUBE_API_KEY)
            .then(() => {
              console.log('[Main] Migrated API key from', configPath, 'to secure storage')
              try {
                fs.unlinkSync(configPath)
                console.log('[Main] Deleted plaintext config file')
              } catch {}
            })
            .catch((error) => {
              console.warn('Không migrate được YOUTUBE_API_KEY từ file config:', error)
            })
        }
        return config
      } catch (error) {
        console.warn('Không đọc được config từ', configPath)
      }
    }
  }
  return null
}

function layDistRootPathChoRelay() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'dist') : '',
    distRootPath,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', 'dist') : '',
    path.join(app.getAppPath(), 'dist'),
    path.join(process.cwd(), 'dist'),
  ].filter(Boolean)

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) || distRootPath
}

async function batRemoteRelayNeuCan() {
  if (remoteRelayStarted || process.env.KARAOKEYT_DISABLE_EMBEDDED_RELAY === '1') return

  activeRelayPort = Number(process.env.PORT || process.env.RELAY_PORT || activeRelayPort || '8787')
  if (await kiemTraRelayLocal(activeRelayPort)) {
    if (await kiemTraRelayLan(activeRelayPort)) {
      remoteRelayStarted = true
      return
    }
    console.warn(`Có relay local trên cổng ${activeRelayPort} nhưng chưa truy cập được qua IP LAN. Thử mở relay nhúng trên cổng khác.`)
  }

  // Read config before starting relay
  docConfigMayChu()

  const relayScriptPath = [
    path.join(__dirname, '..', 'server', 'remoteRelay.mjs'),
    path.join(process.resourcesPath || '', 'server', 'remoteRelay.mjs'),
    path.join(app.getAppPath(), 'server', 'remoteRelay.mjs'),
  ].find((candidate) => candidate && fs.existsSync(candidate))

  if (!relayScriptPath) {
    console.warn('Không tìm thấy server/remoteRelay.mjs để mở relay nhúng.')
    return
  }

  activeRelayPort = await timCongRelayKhaDung()
  process.env.RELAY_HOST = process.env.RELAY_HOST || '0.0.0.0'
  process.env.PORT = String(activeRelayPort)
  process.env.RELAY_PORT = String(activeRelayPort)
  process.env.KARAOKEYT_DIST_DIR = process.env.KARAOKEYT_DIST_DIR || layDistRootPathChoRelay()
  process.env.KARAOKEYT_MEDIA_DIR = process.env.KARAOKEYT_MEDIA_DIR || damBaoThuMucMediaLocal()

  try {
    await import(pathToFileURL(relayScriptPath).href)
    remoteRelayStarted = await doiRelayLocalSanSang(4000, activeRelayPort)
    if (!remoteRelayStarted) {
      console.warn(`Relay nhúng chưa sẵn sàng trên cổng local ${activeRelayPort} sau khi khởi động.`)
    } else if (!(await kiemTraRelayLan(activeRelayPort))) {
      console.warn(`Relay nhúng chạy local nhưng chưa truy cập được qua IP LAN trên cổng ${activeRelayPort}. Có thể Windows Firewall đang chặn.`)
    }
  } catch (error) {
    console.warn('Không mở được relay nhúng:', error)
  }
}

function taoThongTinManHinh(display, index) {
  return {
    index,
    id: display.id,
    label: `${display.label || `Màn hình ${index + 1}`} • ${display.bounds.width}x${display.bounds.height}${display.primary ? ' • chính' : ''}`,
    isPrimary: display.primary,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
    },
  }
}

function layDanhSachManHinh() {
  return screen.getAllDisplays().map((display, index) => taoThongTinManHinh(display, index))
}

function chuanHoaYoutubeVideoId(videoId) {
  const cleaned = String(videoId || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 32)
  if (!cleaned) {
    throw new Error('Video ID không hợp lệ.')
  }
  return cleaned
}

function taoYoutubeWatchUrl(videoId) {
  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', chuanHoaYoutubeVideoId(videoId))
  url.searchParams.set('autoplay', '1')
  return url.toString()
}

function taoYoutubeLoginUrl() {
  return 'https://www.youtube.com/account'
}

function chonManHinh(preferredIndex) {
  const displays = screen.getAllDisplays()
  const fallbackIndex = displays.length > 1 ? 1 : 0
  const requestedIndex =
    typeof preferredIndex === 'number' && Number.isFinite(preferredIndex) ? preferredIndex : fallbackIndex
  const index = Math.max(0, Math.min(requestedIndex, Math.max(0, displays.length - 1)))
  const display = displays[index] ?? screen.getPrimaryDisplay()

  return {
    index,
    display,
    multiDisplay: displays.length > 1,
  }
}

async function taiRenderer(targetWindow, targetScreen, roomCode, roomToken, displayTarget) {
  const baseUrl = await batMayChuRenderer()
  const url = new URL(baseUrl)
  const relayProtocol = url.protocol === 'https:' ? 'wss' : 'ws'
  if (activeRelayPort) {
    url.searchParams.set('relay', `${relayProtocol}://127.0.0.1:${activeRelayPort}/`)
  }
  url.searchParams.set('screen', targetScreen)
  if (roomCode) {
    url.searchParams.set('room', String(roomCode))
  } else {
    url.searchParams.delete('room')
  }
  if (roomToken) {
    url.searchParams.set('token', String(roomToken))
  } else {
    url.searchParams.delete('token')
  }
  if (displayTarget) {
    url.searchParams.set('displayTarget', String(displayTarget))
  } else {
    url.searchParams.delete('displayTarget')
  }
  await targetWindow.loadURL(url.toString())
}

function apDungKhungCuaSoTrinhChieu(targetWindow, preferredIndex) {
  const { display, index, multiDisplay } = chonManHinh(preferredIndex)

  if (targetWindow.isFullScreen()) {
    targetWindow.setFullScreen(false)
  }

  if (multiDisplay) {
    targetWindow.setBounds(display.bounds)
    targetWindow.setFullScreen(true)
  } else {
    const width = Math.min(1400, Math.max(960, display.workArea.width - 120))
    const height = Math.min(840, Math.max(540, display.workArea.height - 120))
    targetWindow.setBounds({
      x: display.workArea.x + Math.max(0, Math.floor((display.workArea.width - width) / 2)),
      y: display.workArea.y + Math.max(0, Math.floor((display.workArea.height - height) / 2)),
      width,
      height,
    })
  }

  return taoThongTinManHinh(display, index)
}

function dongCuaSoYoutubeTrucTiep() {
  if (youtubeWindow && !youtubeWindow.isDestroyed()) {
    youtubeWindow.close()
  }
  youtubeWindow = null
}

async function moDangNhapYoutube() {
  if (!youtubeLoginWindow || youtubeLoginWindow.isDestroyed()) {
    youtubeLoginWindow = new BrowserWindow({
      title: 'Đăng nhập YouTube',
      width: 1120,
      height: 820,
      minWidth: 860,
      minHeight: 640,
      autoHideMenuBar: true,
      backgroundColor: '#0b0b10',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    youtubeLoginWindow.webContents.setUserAgent(taoUserAgent())
    youtubeLoginWindow.on('closed', () => {
      youtubeLoginWindow = null
    })
  }

  youtubeLoginWindow.show()
  youtubeLoginWindow.focus()
  await youtubeLoginWindow.loadURL(taoYoutubeLoginUrl())
  return { success: true }
}

function layManHinhTrinhChieuTuSender(sender) {
  if (displayWindow && !displayWindow.isDestroyed()) {
    return screen.getDisplayMatching(displayWindow.getBounds())
  }

  const senderWindow = sender ? BrowserWindow.fromWebContents(sender) : null
  if (senderWindow && !senderWindow.isDestroyed()) {
    return screen.getDisplayMatching(senderWindow.getBounds())
  }

  const displays = screen.getAllDisplays()
  return displays.length > 1 ? displays[1] : screen.getPrimaryDisplay()
}

async function moYoutubeTrucTiepTrenManHinhTrinhChieu(videoId, sender) {
  const youtubeUrl = taoYoutubeWatchUrl(videoId)
  const display = layManHinhTrinhChieuTuSender(sender)

  if (!youtubeWindow || youtubeWindow.isDestroyed()) {
    youtubeWindow = new BrowserWindow({
      title: 'KaraokeYT YouTube',
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      show: false,
      fullscreen: true,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    youtubeWindow.webContents.setUserAgent(taoUserAgent())
    youtubeWindow.on('closed', () => {
      youtubeWindow = null
    })
  } else {
    youtubeWindow.setBounds(display.bounds)
  }

  youtubeWindow.setFullScreen(true)
  await youtubeWindow.loadURL(youtubeUrl)
  youtubeWindow.show()
  youtubeWindow.focus()

  setTimeout(() => {
    if (!youtubeWindow || youtubeWindow.isDestroyed()) return
    youtubeWindow.focus()
    youtubeWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'f' })
    youtubeWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'f' })
  }, 1800)

  return { success: true }
}

async function nhapMediaDiaPhuong() {
  const result = await dialog.showOpenDialog(controlWindow && !controlWindow.isDestroyed() ? controlWindow : undefined, {
    title: 'Chọn ảnh hoặc video cho màn chiếu',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Ảnh và video',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'm4v'],
      },
    ],
  })

  if (result.canceled || !result.filePaths.length) {
    return { success: true, items: [] }
  }

  const mediaDir = damBaoThuMucMediaLocal()
  const items = []

  for (const filePath of result.filePaths) {
    const extname = path.extname(filePath).toLowerCase()
    if (!LOCAL_MEDIA_EXTENSIONS.has(extname)) continue

    const type = layLoaiMediaTheoExt(extname)
    if (!type) continue

    const fileName = taoTenFileMedia(extname)
    const targetPath = path.join(mediaDir, fileName)
    fs.copyFileSync(filePath, targetPath)

    const addedAt = Date.now()
    items.push({
      id: `media-${addedAt}-${crypto.randomBytes(5).toString('hex')}`,
      type,
      name: path.basename(filePath),
      url: taoUrlMediaLocal(fileName),
      addedAt,
    })
  }

  return { success: true, items }
}

async function taoCuaSoDieuKhien() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.focus()
    return controlWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()

  controlWindow = new BrowserWindow({
    title: 'KaraokeYT Control',
    x: primaryDisplay.workArea.x + 48,
    y: primaryDisplay.workArea.y + 48,
    width: Math.min(1440, primaryDisplay.workArea.width),
    height: Math.min(920, primaryDisplay.workArea.height),
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  controlWindow.webContents.setUserAgent(taoUserAgent())
  ganTheoDoiCuaSo('control', controlWindow)

  controlWindow.on('closed', () => {
    controlWindow = null
  })

  await taiRenderer(controlWindow, 'control')
  controlWindow.show()
  controlWindow.focus()
  return controlWindow
}

async function taoCuaSoTrinhChieu(preferredIndex, roomCode, roomToken) {
  if (displayWindow && !displayWindow.isDestroyed()) {
    if (roomCode) {
      await taiRenderer(displayWindow, 'display', roomCode, roomToken, 'laptop')
    }
    const display = apDungKhungCuaSoTrinhChieu(displayWindow, preferredIndex)
    displayWindow.show()
    displayWindow.focus()
    return { display, reused: true }
  }

  const { display, multiDisplay } = chonManHinh(preferredIndex)

  displayWindow = new BrowserWindow({
    title: 'KaraokeYT Display',
    x: display.bounds.x,
    y: display.bounds.y,
    width: multiDisplay ? display.bounds.width : 1280,
    height: multiDisplay ? display.bounds.height : 720,
    show: false,
    fullscreen: multiDisplay,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  displayWindow.webContents.setUserAgent(taoUserAgent())
  ganTheoDoiCuaSo('display', displayWindow)

  displayWindow.on('closed', () => {
    displayWindow = null
    dongCuaSoYoutubeTrucTiep()
  })

  await taiRenderer(displayWindow, 'display', roomCode, roomToken, 'laptop')
  const appliedDisplay = apDungKhungCuaSoTrinhChieu(displayWindow, preferredIndex)
  displayWindow.show()

  return { display: appliedDisplay, reused: false }
}

function dongCuaSoTrinhChieu() {
  const coCuaSoDangMo = Boolean(displayWindow && !displayWindow.isDestroyed())
  if (coCuaSoDangMo) {
    displayWindow.close()
  }
  dongCuaSoYoutubeTrucTiep()
  return { success: true, closed: coCuaSoDangMo }
}

function dangKyIpc() {
  ipcMain.handle('karaoke:get-displays', () => layDanhSachManHinh())
  ipcMain.handle('karaoke:get-network-info', () => layThongTinMangDesktop())
  ipcMain.handle('karaoke:import-local-media', async () => {
    try {
      return await nhapMediaDiaPhuong()
    } catch (error) {
      console.warn('Không thêm được ảnh/video local:', error)
      return { success: false, error: error?.message || 'Không thêm được ảnh/video từ máy tính.' }
    }
  })

  ipcMain.handle('karaoke:open-display-window', async (_event, preferredIndex, roomCode, roomToken) => {
    dongCuaSoYoutubeTrucTiep()
    return taoCuaSoTrinhChieu(preferredIndex, roomCode, roomToken)
  })

  ipcMain.handle('karaoke:close-display-window', () => {
    try {
      return dongCuaSoTrinhChieu()
    } catch (error) {
      console.warn('Không tắt được màn hình trình chiếu:', error)
      return { success: false, error: error?.message || 'Không tắt được màn hình trình chiếu.' }
    }
  })

  ipcMain.handle('karaoke:open-youtube-on-display', async (event, videoId) => {
    try {
      return await moYoutubeTrucTiepTrenManHinhTrinhChieu(videoId, event.sender)
    } catch (error) {
      console.warn('Không mở được YouTube trực tiếp trên màn hình trình chiếu:', error)
      return { success: false, error: error?.message || 'Không mở được YouTube trực tiếp.' }
    }
  })

  ipcMain.handle('karaoke:close-youtube-on-display', () => {
    dongCuaSoYoutubeTrucTiep()
    return { success: true }
  })

  ipcMain.handle('karaoke:open-youtube-login', async () => {
    try {
      return await moDangNhapYoutube()
    } catch (error) {
      console.warn('Không mở được đăng nhập YouTube:', error)
      return { success: false, error: error?.message || 'Không mở được đăng nhập YouTube.' }
    }
  })

  ipcMain.on('karaoke:sync', (event, msg) => {
    for (const targetWindow of BrowserWindow.getAllWindows()) {
      if (targetWindow.webContents.id === event.sender.id) continue
      targetWindow.webContents.send('karaoke:sync', msg)
    }
  })
}

// Register IPC handlers for secure storage
ipcMain.handle('secure-storage:save-key', async (_event, apiKey) => {
  try {
    const validation = await secureStorage.validateApiKey(apiKey)
    if (!validation.valid) {
      return { success: false, error: validation.message }
    }
    await secureStorage.saveApiKey(apiKey)
    return { success: true, message: validation.message || 'Đã lưu YouTube API key trên laptop.' }
  } catch (error) {
    console.error('[IPC] Failed to save API key:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('secure-storage:get-key', async () => {
  try {
    const key = await secureStorage.getApiKey()
    return { success: true, key }
  } catch (error) {
    console.error('[IPC] Failed to get API key:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('secure-storage:delete-key', async () => {
  try {
    await secureStorage.deleteApiKey()
    return { success: true }
  } catch (error) {
    console.error('[IPC] Failed to delete API key:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('secure-storage:has-key', async () => {
  try {
    const hasKey = await secureStorage.hasApiKey()
    return { success: true, hasKey }
  } catch (error) {
    console.error('[IPC] Failed to check API key:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('secure-storage:check-key', async () => {
  try {
    const result = await secureStorage.validateStoredApiKey()
    return {
      success: true,
      valid: result.valid,
      message: result.message,
    }
  } catch (error) {
    console.error('[IPC] Failed to validate API key:', error)
    return { success: false, error: error.message }
  }
})

app.whenReady().then(async () => {
  try {
    // Init secure storage first
    await initSecureStorage()
    docConfigMayChu() // Migrate legacy config if exists
    
    await batRemoteRelayNeuCan()
    dangKyIpc()
    await taoCuaSoDieuKhien()
    if (process.env.KARAOKEYT_OPEN_DISPLAY_ON_START === '1') {
      await taoCuaSoTrinhChieu()
    }

    // Setup auto-updater (only after windows are created)
    if (controlWindow) {
      setupAutoUpdate(controlWindow)
    }

    app.on('activate', async () => {
      try {
        if (BrowserWindow.getAllWindows().length === 0) {
          await taoCuaSoDieuKhien()
          if (process.env.KARAOKEYT_OPEN_DISPLAY_ON_START === '1') {
            await taoCuaSoTrinhChieu()
          }
          return
        }

        if (!controlWindow || controlWindow.isDestroyed()) {
          await taoCuaSoDieuKhien()
        }
      } catch (error) {
        await baoLoiNghiemTrong(error, 'Lỗi kích hoạt lại desktop')
      }
    })
  } catch (error) {
    await baoLoiNghiemTrong(error, 'Lỗi khởi động desktop')
  }
})

process.on('uncaughtException', (error) => {
  void baoLoiNghiemTrong(error, 'Uncaught exception')
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  void baoLoiNghiemTrong(error, 'Unhandled rejection')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (rendererServer) {
    rendererServer.close()
    rendererServer = null
    rendererBaseUrl = null
  }
})
