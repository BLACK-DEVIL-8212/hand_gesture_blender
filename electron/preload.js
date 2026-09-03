const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('electron:set-always-on-top', flag),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.invoke('electron:set-ignore-mouse-events', ignore),
  setWindowBounds: (bounds) => ipcRenderer.invoke('electron:set-window-bounds', bounds),
  getWindowBounds: () => ipcRenderer.invoke('electron:get-window-bounds'),
  minimizeWindow: () => ipcRenderer.invoke('electron:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('electron:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('electron:close-window'),
  isMaximized: () => ipcRenderer.invoke('electron:is-maximized'),
  onReady: (callback) => ipcRenderer.on('electron-ready', (_event, value) => callback(value)),
});
