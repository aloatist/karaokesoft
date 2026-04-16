/**
 * Auto Update Module for KaraokeYT Desktop App
 * Using electron-updater with GitHub releases or custom server
 */

const { autoUpdater } = require('electron-updater')
const { ipcMain, dialog, BrowserWindow } = require('electron')
const log = require('electron-log')

// Configure logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// Update configuration
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // Check every hour
let updateInterval = null
let mainWindow = null

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

function setupAutoUpdate(window) {
  mainWindow = window

  // Configure auto-updater
  autoUpdater.autoDownload = false // Manual download to show progress
  autoUpdater.autoInstallOnAppQuit = true

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    currentState = UpdateState.CHECKING
    notifyRenderer('update:checking')
    log.info('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    currentState = UpdateState.AVAILABLE
    updateInfo = info
    notifyRenderer('update:available', info)
    log.info('Update available:', info)

    // Show dialog to user
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Cập nhật mới có sẵn',
        message: `Phiên bản ${info.version} đã có sẵn`,
        detail: `Phiên bản hiện tại: ${autoUpdater.currentVersion}\n\nBạn có muốn tải xuống ngay bây giờ?`,
        buttons: ['Tải xuống', 'Để sau'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-not-available', (info) => {
    currentState = UpdateState.NOT_AVAILABLE
    notifyRenderer('update:not-available', info)
    log.info('Update not available:', info)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    currentState = UpdateState.DOWNLOADING
    notifyRenderer('update:progress', progressObj)
    log.info('Download progress:', progressObj.percent)
  })

  autoUpdater.on('update-downloaded', (info) => {
    currentState = UpdateState.DOWNLOADED
    updateInfo = info
    notifyRenderer('update:downloaded', info)
    log.info('Update downloaded:', info)

    // Prompt to install
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Cập nhật đã sẵn sàng',
        message: `Phiên bản ${info.version} đã tải xuống`,
        detail: 'Ứng dụng sẽ khởi động lại để cài đặt cập nhật.',
        buttons: ['Khởi động lại ngay', 'Cài đặt sau'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    currentState = UpdateState.ERROR
    notifyRenderer('update:error', err.message)
    log.error('Update error:', err)
  })

  // IPC handlers
  ipcMain.handle('update:check', async () => {
    try {
      await checkForUpdates()
      return { success: true, state: currentState, info: updateInfo }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('update:get-state', () => {
    return { state: currentState, info: updateInfo }
  })

  // Start periodic checks
  startPeriodicChecks()

  // Check immediately on startup (after 5 seconds)
  setTimeout(() => {
    checkForUpdates()
  }, 5000)
}

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

async function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    log.info('Skipping update check in development mode')
    return
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    log.error('Failed to check for updates:', error)
  }
}

async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    log.error('Failed to download update:', error)
    dialog.showErrorBox('Lỗi cập nhật', `Không thể tải xuống: ${error.message}`)
  }
}

function startPeriodicChecks() {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  updateInterval = setInterval(() => {
    checkForUpdates()
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
