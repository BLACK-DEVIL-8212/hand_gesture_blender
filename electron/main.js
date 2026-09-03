const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    x: Math.max(0, Math.floor((screenWidth - 900) / 2)),
    y: Math.max(0, Math.floor((screenHeight - 650) / 2)),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('electron-ready', {
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height,
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('electron:set-always-on-top', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag, 'screen-saver');
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('electron:set-ignore-mouse-events', (_event, ignore) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    return ignore;
  }
  return false;
});

ipcMain.handle('electron:set-window-bounds', (_event, bounds) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setBounds({
      x: bounds.x ?? x,
      y: bounds.y ?? y,
      width: bounds.width ?? mainWindow.getBounds().width,
      height: bounds.height ?? mainWindow.getBounds().height,
    });
    return mainWindow.getBounds();
  }
  return null;
});

ipcMain.handle('electron:get-window-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return null;
});

ipcMain.handle('electron:minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('electron:maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('electron:close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('electron:is-maximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});
