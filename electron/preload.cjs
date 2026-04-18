const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('karaokeDesktop', {
  isElectron: true,
  __ELECTRON__: true,
  getDisplays: () => ipcRenderer.invoke('karaoke:get-displays'),
  openDisplayWindow: (monitorIndex, roomCode, roomToken) => ipcRenderer.invoke('karaoke:open-display-window', monitorIndex, roomCode, roomToken),
  openYoutubeOnDisplay: (videoId) => ipcRenderer.invoke('karaoke:open-youtube-on-display', videoId),
  closeYoutubeOnDisplay: () => ipcRenderer.invoke('karaoke:close-youtube-on-display'),
  openYoutubeLogin: () => ipcRenderer.invoke('karaoke:open-youtube-login'),
  sendSyncMessage: (msg) => ipcRenderer.send('karaoke:sync', msg),
  onSyncMessage: (listener) => {
    const wrapped = (_event, msg) => listener(msg)
    ipcRenderer.on('karaoke:sync', wrapped)
    return () => {
      ipcRenderer.removeListener('karaoke:sync', wrapped)
    }
  },
  // Secure storage API for YouTube API Key
  secureStorage: {
    saveKey: (apiKey) => ipcRenderer.invoke('secure-storage:save-key', apiKey),
    getKey: () => ipcRenderer.invoke('secure-storage:get-key'),
    deleteKey: () => ipcRenderer.invoke('secure-storage:delete-key'),
    hasKey: () => ipcRenderer.invoke('secure-storage:has-key'),
  },
  // Auto-updater API
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getState: () => ipcRenderer.invoke('update:get-state'),
  },
  onUpdateMessage: (callback) => {
    const listeners = [
      ['update:checking', () => callback('update:checking', null)],
      ['update:available', (_e, info) => callback('update:available', info)],
      ['update:not-available', (_e, info) => callback('update:not-available', info)],
      ['update:progress', (_e, progress) => callback('update:progress', progress)],
      ['update:downloaded', (_e, info) => callback('update:downloaded', info)],
      ['update:error', (_e, err) => callback('update:error', err)],
    ]
    listeners.forEach(([channel, listener]) => {
      ipcRenderer.on(channel, listener)
    })
    return () => {
      listeners.forEach(([channel, listener]) => {
        ipcRenderer.removeListener(channel, listener)
      })
    }
  },
})
