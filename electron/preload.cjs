const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('karaokeDesktop', {
  isElectron: true,
  getDisplays: () => ipcRenderer.invoke('karaoke:get-displays'),
  openDisplayWindow: (monitorIndex, roomCode) => ipcRenderer.invoke('karaoke:open-display-window', monitorIndex, roomCode),
  sendSyncMessage: (msg) => ipcRenderer.send('karaoke:sync', msg),
  onSyncMessage: (listener) => {
    const wrapped = (_event, msg) => listener(msg)
    ipcRenderer.on('karaoke:sync', wrapped)
    return () => {
      ipcRenderer.removeListener('karaoke:sync', wrapped)
    }
  },
})
