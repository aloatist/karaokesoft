const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { app, BrowserWindow, ipcMain, screen } = require('electron')

const preloadPath = path.join(__dirname, 'preload.cjs')
const distRootPath = path.join(__dirname, '..', 'dist')
const devServerUrl = process.env.VITE_DEV_SERVER_URL

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let controlWindow = null
let displayWindow = null
let rendererServer = null
let rendererBaseUrl = null

function taoUserAgent() {
  return (app.userAgentFallback || '').replace(/\sElectron\/[\d.]+/, '')
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
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

async function batMayChuRenderer() {
  if (devServerUrl) {
    rendererBaseUrl = devServerUrl
    return rendererBaseUrl
  }

  if (rendererBaseUrl) {
    return rendererBaseUrl
  }

  rendererServer = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(reqUrl.pathname)
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const normalizedPath = path.normalize(relativePath)
    const filePath = path.join(distRootPath, normalizedPath)
    const namTrongDist = filePath.startsWith(distRootPath)
    const targetPath = namTrongDist && fs.existsSync(filePath) ? filePath : path.join(distRootPath, 'index.html')

    fs.readFile(targetPath, (error, data) => {
      if (error) {
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

async function taiRenderer(targetWindow, targetScreen) {
  const baseUrl = await batMayChuRenderer()
  const url = new URL(baseUrl)
  url.searchParams.set('screen', targetScreen)
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

  controlWindow.on('closed', () => {
    controlWindow = null
  })

  await taiRenderer(controlWindow, 'control')
  return controlWindow
}

async function taoCuaSoTrinhChieu(preferredIndex) {
  if (displayWindow && !displayWindow.isDestroyed()) {
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

  displayWindow.on('closed', () => {
    displayWindow = null
  })

  await taiRenderer(displayWindow, 'display')
  const appliedDisplay = apDungKhungCuaSoTrinhChieu(displayWindow, preferredIndex)
  displayWindow.show()

  return { display: appliedDisplay, reused: false }
}

function dangKyIpc() {
  ipcMain.handle('karaoke:get-displays', () => layDanhSachManHinh())

  ipcMain.handle('karaoke:open-display-window', async (_event, preferredIndex) => {
    return taoCuaSoTrinhChieu(preferredIndex)
  })

  ipcMain.on('karaoke:sync', (event, msg) => {
    for (const targetWindow of BrowserWindow.getAllWindows()) {
      if (targetWindow.webContents.id === event.sender.id) continue
      targetWindow.webContents.send('karaoke:sync', msg)
    }
  })
}

app.whenReady().then(async () => {
  dangKyIpc()
  await taoCuaSoDieuKhien()
  await taoCuaSoTrinhChieu()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await taoCuaSoDieuKhien()
      await taoCuaSoTrinhChieu()
      return
    }

    if (!controlWindow || controlWindow.isDestroyed()) {
      await taoCuaSoDieuKhien()
    }

    if (!displayWindow || displayWindow.isDestroyed()) {
      await taoCuaSoTrinhChieu()
    }
  })
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
