const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';

const http = require('http');

let activeServerUrl = null;

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

async function createWindow() {
    const mainWindow = new BrowserWindow({
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
}

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Helper to send status to renderer
function sendStatusToWindow(text, data = null) {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-status', { text, data });
    });
}

autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.', info);
});

autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.', info);
});

autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded', info);
});

app.whenReady().then(() => {
    createWindow();

    // Check for updates on startup
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
        // Simulate update check in dev mode so UI doesn't hang
        sendStatusToWindow('Checking for updates...');
        setTimeout(() => {
            sendStatusToWindow('Update not available', {
                version: app.getVersion(),
                releaseNotes: 'Updates are only available in production builds.'
            });
        }, 2000);
        return;
    }

    try {
        await autoUpdater.checkForUpdates();
    } catch (error) {
        sendStatusToWindow('Error: ' + error.message);
    }
});

ipcMain.handle('quit-and-install', () => {
    console.log('User requested quit and install...');
    autoUpdater.quitAndInstall(false, true);
});
