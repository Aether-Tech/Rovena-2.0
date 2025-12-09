const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, value) => callback(value)),
    removeUpdateStatusListener: (callback) => ipcRenderer.removeListener('update-status', callback) // Simplification, usually requires proper handler reference
});
