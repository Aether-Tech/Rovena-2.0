const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    startDownload: () => ipcRenderer.invoke('start-download'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, value) => callback(value)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, value) => callback(value)),
    removeUpdateStatusListener: (callback) => ipcRenderer.removeListener('update-status', callback),
    removeUpdateErrorListener: (callback) => ipcRenderer.removeListener('update-error', callback),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getLatestReleaseUrl: () => ipcRenderer.invoke('get-latest-release-url'),
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});