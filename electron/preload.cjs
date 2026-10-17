const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tideElectron', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('tide:window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('tide:window:toggleMaximize'),
  close: () => ipcRenderer.invoke('tide:window:close'),
  setAlwaysOnTop: (enabled) =>
    ipcRenderer.invoke('tide:window:setAlwaysOnTop', enabled),
  setMiniPlayer: (enabled) =>
    ipcRenderer.invoke('tide:window:setMiniPlayer', enabled),
  openDirectoryDialog: () => ipcRenderer.invoke('tide:dialog:openDirectory'),
  getAppInfo: () => ipcRenderer.invoke('tide:app:getInfo'),
  onMediaKey: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('tide:media-key', handler);
    return () => ipcRenderer.removeListener('tide:media-key', handler);
  },
  onWindowState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('tide:window-state', handler);
    return () => ipcRenderer.removeListener('tide:window-state', handler);
  },
});
