/**
 * Auto Update Module for KaraokeYT Desktop App
 * Using electron-updater with GitHub releases or custom server
 */

const { autoUpdater } = require('electron-updater')
const { app, ipcMain } = require('electron')
const log = require('electron-log')

// Configure logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// Update configuration
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // Check every hour
let updateInterval = null
let mainWindow = null
let handlersRegistered = false
let checkingPromise = null
let downloadingPromise = null

// Update states
const UpdateState = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  NOT_AVAILABLE: 'not-available',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  ERROR: 'error',
}

let currentState = UpdateState.IDLE
let updateInfo = null
let updateProgress = null
let lastError = null

function setupAutoUpdate(window) {
  mainWindow = window

  // Configure auto-updater
  autoUpdater.autoDownload = false // Người dùng chủ động bấm tải trong UI.
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = process.env.KARAOKEYT_UPDATE_PRERELEASE === '1'

  if (handlersRegistered) {
    return
  }
  handlersRegistered = true

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    currentState = UpdateState.CHECKING
    lastError = null
    notifyRenderer('update:checking')
    log.info('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    currentState = UpdateState.AVAILABLE
    updateInfo = info
    updateProgress = null
    lastError = null
    notifyRenderer('update:available', info)
    log.info('Update available:', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    currentState = UpdateState.NOT_AVAILABLE
    notifyRenderer('update:not-available', info)
    log.info('Update not available:', info)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    currentState = UpdateState.DOWNLOADING
    updateProgress = progressObj
    lastError = null
    notifyRenderer('update:progress', progressObj)
    log.info('Download progress:', progressObj.percent)
  })

  autoUpdater.on('update-downloaded', (info) => {
    currentState = UpdateState.DOWNLOADED
    updateInfo = info
    lastError = null
    notifyRenderer('update:downloaded', info)
    log.info('Update downloaded:', info)
  })

  autoUpdater.on('error', (err) => {
    currentState = UpdateState.ERROR
    lastError = err?.message || 'Không kiểm tra được cập nhật'
    notifyRenderer('update:error', lastError)
    log.error('Update error:', err)
  })

  // IPC handlers
  ipcMain.handle('update:check', async () => {
    try {
      const result = await checkForUpdates()
      return taoKetQuaTrangThai({ result })
    } catch (error) {
      return taoKetQuaTrangThai({ success: false, error })
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await downloadUpdate()
      return taoKetQuaTrangThai()
    } catch (error) {
      return taoKetQuaTrangThai({ success: false, error })
    }
  })

  ipcMain.handle('update:install', () => {
    if (currentState !== UpdateState.DOWNLOADED) {
      return { success: false, error: 'Chưa có bản cập nhật đã tải xong để cài.' }
    }
    autoUpdater.quitAndInstall()
    return { success: true }
  })

  ipcMain.handle('update:get-state', () => {
    return taoKetQuaTrangThai()
  })

  if (app.isPackaged) {
    // Start periodic checks
    startPeriodicChecks()

    // Check immediately on startup (after 5 seconds)
    setTimeout(() => {
      checkForUpdates().catch(() => undefined)
    }, 5000)
  }
}

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function layTenNenTang() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'linux') return 'linux'
  return process.platform
}

function taoKetQuaTrangThai({ success = true, error, result } = {}) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : lastError
  return {
    success,
    state: currentState,
    info: updateInfo,
    progress: updateProgress,
    error: message || undefined,
    currentVersion: String(autoUpdater.currentVersion || app.getVersion()),
    isPackaged: app.isPackaged,
    platform: layTenNenTang(),
    updateResult: result
      ? {
          updateInfo: result.updateInfo,
        }
      : undefined,
  }
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    log.info('Skipping update check in development mode')
    currentState = UpdateState.ERROR
    const message = 'Cập nhật desktop chỉ hoạt động sau khi app đã được đóng gói.'
    lastError = message
    notifyRenderer('update:error', message)
    throw new Error(message)
  }

  if (checkingPromise) return checkingPromise

  try {
    checkingPromise = autoUpdater.checkForUpdates()
    return await checkingPromise
  } catch (error) {
    currentState = UpdateState.ERROR
    updateInfo = null
    lastError = error instanceof Error ? error.message : 'Không kiểm tra được cập nhật'
    notifyRenderer('update:error', lastError)
    log.error('Failed to check for updates:', error)
    throw error
  } finally {
    checkingPromise = null
  }
}

async function downloadUpdate() {
  if (!app.isPackaged) {
    const message = 'Cập nhật desktop chỉ hoạt động sau khi app đã được đóng gói.'
    currentState = UpdateState.ERROR
    lastError = message
    notifyRenderer('update:error', message)
    throw new Error(message)
  }

  if (currentState === UpdateState.DOWNLOADED) {
    return []
  }

  if (downloadingPromise) return downloadingPromise

  try {
    currentState = UpdateState.DOWNLOADING
    notifyRenderer('update:progress', updateProgress || { percent: 0 })
    downloadingPromise = autoUpdater.downloadUpdate()
    return await downloadingPromise
  } catch (error) {
    currentState = UpdateState.ERROR
    lastError = error instanceof Error ? error.message : 'Không tải được cập nhật'
    notifyRenderer('update:error', lastError)
    log.error('Failed to download update:', error)
    throw error
  } finally {
    downloadingPromise = null
  }
}

function startPeriodicChecks() {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  updateInterval = setInterval(() => {
    checkForUpdates().catch(() => undefined)
  }, UPDATE_CHECK_INTERVAL)
}

function stopPeriodicChecks() {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}

module.exports = {
  setupAutoUpdate,
  checkForUpdates,
  downloadUpdate,
  startPeriodicChecks,
  stopPeriodicChecks,
  UpdateState,
}
