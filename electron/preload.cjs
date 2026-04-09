const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('karaokeDesktop', {
  isElectron: true,
  getDisplays: () => ipcRenderer.invoke('karaoke:get-displays'),
  openDisplayWindow: (monitorIndex) => ipcRenderer.invoke('karaoke:open-display-window', monitorIndex),
  sendSyncMessage: (msg) => ipcRenderer.send('karaoke:sync', msg),
  onSyncMessage: (listener) => {
    const wrapped = (_event, msg) => listener(msg)
    ipcRenderer.on('karaoke:sync', wrapped)
    return () => {
      ipcRenderer.removeListener('karaoke:sync', wrapped)
    }
  },
})
