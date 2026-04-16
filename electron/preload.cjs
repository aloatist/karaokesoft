const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('karaokeDesktop', {
  isElectron: true,
  __ELECTRON__: true,
  getDisplays: () => ipcRenderer.invoke('karaoke:get-displays'),
  openDisplayWindow: (monitorIndex, roomCode, roomToken) => ipcRenderer.invoke('karaoke:open-display-window', monitorIndex, roomCode, roomToken),
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
})
