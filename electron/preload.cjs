const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-os-platform'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    startDownload: () => ipcRenderer.invoke('start-download'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, value) => callback(value)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, value) => callback(value)),
    removeUpdateStatusListener: (callback) => ipcRenderer.removeListener('update-status', callback),
    removeUpdateErrorListener: (callback) => ipcRenderer.removeListener('update-error', callback),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getLatestReleaseUrl: () => ipcRenderer.invoke('get-latest-release-url'),
    openManualUpdate: () => ipcRenderer.invoke('open-manual-update'),
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),

    browser: {
        attach: (bounds) => ipcRenderer.invoke('browser-attach', bounds),
        updateBounds: (bounds) => ipcRenderer.invoke('browser-update-bounds', bounds),
        destroy: () => ipcRenderer.invoke('browser-destroy'),
        navigate: (url) => ipcRenderer.invoke('browser-navigate', url),
        back: () => ipcRenderer.invoke('browser-back'),
        forward: () => ipcRenderer.invoke('browser-forward'),
        refresh: () => ipcRenderer.invoke('browser-refresh'),
        home: () => ipcRenderer.invoke('browser-home'),
        getUrl: () => ipcRenderer.invoke('browser-get-url'),
    }
});