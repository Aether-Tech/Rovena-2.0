const { app, BrowserWindow, ipcMain, shell, BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const https = require('https');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const http = require('http');

let activeServerUrl = null;
let mainWindow = null;
let browserView = null;
let browserBounds = null;

async function startLocalServer() {
    if (activeServerUrl) return activeServerUrl;

    const handler = (await import('serve-handler')).default;

    return new Promise((resolve, reject) => {
        const server = http.createServer((request, response) => {
            return handler(request, response, {
                public: path.join(__dirname, '../dist'),
                rewrites: [
                    { source: '**', destination: '/index.html' }
                ]
            });
        });

        server.listen(5173, () => {
            const port = 5173;
            activeServerUrl = `http://localhost:${port}`;
            console.log('Server running at:', activeServerUrl);
            resolve(activeServerUrl);
        });

        server.on('error', (err) => {
            console.error('Server failed to start:', err);
            reject(err);
        });
    });
}

function ensureBrowserView() {
    if (!mainWindow || browserView) return;
    browserView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        }
    });
    mainWindow.contentView.addChildView(browserView);
    browserView.webContents.loadURL('https://gamma.app');
}

function applyBrowserBounds(bounds) {
    if (!browserView || !bounds) return;
    browserBounds = bounds;
    browserView.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
    });
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        autoHideMenuBar: true,
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        try {
            const url = await startLocalServer();
            mainWindow.loadURL(url);
        } catch (err) {
            console.error('Failed to load local server:', err);
        }
    }

    mainWindow.on('resize', () => {
        if (browserView && browserBounds) {
            applyBrowserBounds(browserBounds);
        }
    });

    mainWindow.on('closed', () => {
        if (browserView) {
            mainWindow?.contentView.removeChildView(browserView);
            browserView.webContents.destroy();
            browserView = null;
            browserBounds = null;
        }
        mainWindow = null;
    });
}

// Helper to get latest release DMG URL from GitHub
function getLatestReleaseUrl() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/1Verona/Rovena-2.0/releases/latest',
            method: 'GET',
            headers: {
                'User-Agent': 'Rovena-App'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const dmgAsset = release.assets?.find(a => a.name.endsWith('.dmg'));
                    const zipAsset = release.assets?.find(a => a.name.endsWith('.zip') && a.name.includes('mac'));

                    resolve({
                        version: release.tag_name,
                        dmgUrl: dmgAsset?.browser_download_url || null,
                        zipUrl: zipAsset?.browser_download_url || null,
                        releaseUrl: release.html_url
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Configure autoUpdater
autoUpdater.logger = console;
autoUpdater.autoDownload = false; // Disable auto-download to allow user choice
autoUpdater.autoInstallOnAppQuit = false; // We want explicit install
autoUpdater.allowPrerelease = true; // Allow prereleases for testing/dev

// In dev mode, we want to test the real updater
if (isDev) {
    autoUpdater.forceDevUpdateConfig = true;
}

// Helper to send status to renderer
function sendStatusToWindow(text, data = null) {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-status', { text, data });
    });
}

function sendErrorToWindow(error) {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-error', error.message || error.toString());
    });
}

autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('checking-for-update');
});

autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('update-not-available', info);
});

autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Error:', err);
    // If it's the specific "No published versions" error in dev, we might frame it better, but raw error is fine for now
    sendErrorToWindow(err);
});

let downloadedFilePath = null;

autoUpdater.on('download-progress', (progressObj) => {
    sendStatusToWindow('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    // Store the path to the downloaded file (e.g., DMG on macOS)
    if (info.downloadedFile) {
        downloadedFilePath = info.downloadedFile;
    }
    sendStatusToWindow('update-downloaded', info);
});

ipcMain.handle('open-manual-update', async () => {
    if (downloadedFilePath) {
        console.log('Opening downloaded update file:', downloadedFilePath);
        try {
            await shell.openPath(downloadedFilePath);
            return true;
        } catch (err) {
            console.error('Failed to open update file:', err);
            return false;
        }
    } else {
        console.log('No downloaded file path available to open.');
        return false;
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-os-platform', () => {
    return process.platform;
});

ipcMain.handle('check-for-updates', async () => {
    try {
        await autoUpdater.checkForUpdates();
    } catch (error) {
        console.error('Error checking for updates:', error);
        sendErrorToWindow(error);
    }
});

ipcMain.handle('start-download', async () => {
    try {
        await autoUpdater.downloadUpdate();
    } catch (error) {
        console.error('Error starting download:', error);
        sendErrorToWindow(error);
    }
});

ipcMain.handle('quit-and-install', () => {
    console.log('IPC: quit-and-install received. Preparing for installation...');
    try {
        // On macOS, we need to remove blocking event listeners before quitAndInstall
        // Otherwise the app may not properly quit and restart
        if (process.platform === 'darwin') {
            app.removeAllListeners('window-all-closed');
            BrowserWindow.getAllWindows().forEach(win => {
                win.removeAllListeners('close');
            });
        }

        // Use setImmediate to ensure IPC response is sent before quitting
        setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
        });
    } catch (err) {
        console.error('Error in quitAndInstall:', err);
        sendErrorToWindow(err);
    }
});

ipcMain.handle('get-latest-release-url', async () => {
    try {
        return await getLatestReleaseUrl();
    } catch (error) {
        console.error('Error getting latest release:', error);
        return null;
    }
});

ipcMain.handle('open-external-url', async (event, url) => {
    try {
        await shell.openExternal(url);
        return true;
    } catch (error) {
        console.error('Error opening external URL:', error);
        return false;
    }
});

ipcMain.handle('browser-attach', (event, bounds) => {
    ensureBrowserView();
    applyBrowserBounds(bounds);
    return true;
});

ipcMain.handle('browser-update-bounds', (event, bounds) => {
    applyBrowserBounds(bounds);
    return true;
});

ipcMain.handle('browser-destroy', () => {
    if (browserView) {
        mainWindow?.contentView.removeChildView(browserView);
        browserView.webContents.destroy();
        browserView = null;
        browserBounds = null;
    }
    return true;
});

ipcMain.handle('browser-navigate', (event, url) => {
    if (!browserView) return false;
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }
    browserView.webContents.loadURL(finalUrl);
    return true;
});

ipcMain.handle('browser-back', () => {
    if (!browserView) return false;
    if (browserView.webContents.canGoBack()) {
        browserView.webContents.goBack();
        return true;
    }
    return false;
});

ipcMain.handle('browser-forward', () => {
    if (!browserView) return false;
    if (browserView.webContents.canGoForward()) {
        browserView.webContents.goForward();
        return true;
    }
    return false;
});

ipcMain.handle('browser-refresh', () => {
    if (!browserView) return false;
    browserView.webContents.reload();
    return true;
});

ipcMain.handle('browser-home', () => {
    if (!browserView) return false;
    browserView.webContents.loadURL('https://gamma.app');
    return true;
});

ipcMain.handle('browser-get-url', () => {
    if (!browserView) return '';
    return browserView.webContents.getURL();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const mainWindow = windows[0];
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();

        // Check for updates on startup
        if (!isDev) {
            // In production we can rely on the manual check or this one usually check download notify
            // But since we disabled autoDownload, checkForUpdatesAndNotify might behave differently.
            // autoUpdater.checkForUpdates(); // simple check
        }
        // Actually, let's just create window. The user can check manually or we can trigger check via IPC from frontend on mount if we want.
        // For now, let's keep it simple.

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});