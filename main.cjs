const { startServer } = require('./server.cjs');

function createMainWindow({ BrowserWindow, origin = 'http://127.0.0.1:4765' }) {
  if (typeof BrowserWindow !== 'function') {
    throw new TypeError('BrowserWindow must be provided by Electron.');
  }

  const window = new BrowserWindow({
    title: 'MONEYMAXING',
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: '#101413',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  window.setMenuBarVisibility(false);
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session?.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.session?.setPermissionCheckHandler(() => false);
  window.loadURL(origin);
  return window;
}

if (require.main === module) {
  const { app, BrowserWindow, dialog } = require('electron');
  const path = require('node:path');
  if (process.env.MONEYMAXING_DATA_DIR) app.setPath('userData', path.resolve(process.env.MONEYMAXING_DATA_DIR));
  const primary = app.requestSingleInstanceLock();
  if (!primary) app.quit();
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
  });
  let service = null;

  function openMainWindow() {
    createMainWindow({ BrowserWindow, origin: service.origin });
  }

  if (primary) app.whenReady().then(async () => {
    try {
      if (process.platform === 'win32' && app.setAppUserModelId) {
        app.setAppUserModelId('com.moneymaxing.desktop');
      }
      service = await startServer({
        appDir: __dirname,
        dataDir: app.getPath('userData'),
        host: '127.0.0.1',
        port: Number(process.env.MONEYMAXING_PORT || 4765),
        publicOrigin: process.env.MONEYMAXING_PUBLIC_ORIGIN || ''
      });
      openMainWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) openMainWindow();
      });
    } catch (error) {
      dialog.showErrorBox(
        'MONEYMAXING no pudo iniciar',
        `No se pudo iniciar el servicio local en el puerto 4765. Cierra otra instancia e inténtalo de nuevo.\n\n${error.message}`
      );
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (service) {
      const running = service;
      service = null;
      running.close().catch(() => {});
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = { createMainWindow };
