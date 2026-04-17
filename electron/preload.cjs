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
    const wrapped = (_event, channel, data) => callback(channel, data)
    ipcRenderer.on('update:checking', () => wrapped(null, 'update:checking', null))
    ipcRenderer.on('update:available', (_e, info) => wrapped(null, 'update:available', info))
    ipcRenderer.on('update:progress', (_e, progress) => wrapped(null, 'update:progress', progress))
    ipcRenderer.on('update:downloaded', (_e, info) => wrapped(null, 'update:downloaded', info))
    ipcRenderer.on('update:error', (_e, err) => wrapped(null, 'update:error', err))
    return () => {
      ipcRenderer.removeAllListeners('update:checking')
      ipcRenderer.removeAllListeners('update:available')
      ipcRenderer.removeAllListeners('update:progress')
      ipcRenderer.removeAllListeners('update:downloaded')
      ipcRenderer.removeAllListeners('update:error')
    }
  },
})
