const { app, BrowserWindow, session, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

// Use shared session storage so all iCloud apps share authentication
app.setPath('sessionData', path.join(app.getPath('appData'), 'icloud-session'));

let mainWindow, tray, isQuitting = false;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); if (!mainWindow.isVisible()) mainWindow.show(); mainWindow.focus(); }
  });
}

function createWindow() {
  if (mainWindow) return;
  mainWindow = new BrowserWindow({ width: 1920, height: 1080, webPreferences: { nodeIntegration: true, partition: 'persist:icloud' } });
  const ses = mainWindow.webContents.session;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15";
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.on("new-window", (event, url) => { event.preventDefault(); if (url !== "about:blank#blocked") shell.openExternal(url); });
  mainWindow.loadURL('https://www.icloud.com/notes');
  ses.cookies.on('changed', (event, cookie, cause, removed) => {
    if (!removed && cookie.domain?.includes('.icloud.com') && cookie.name === 'X-APPLE-WEBAUTH-TOKEN')
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
  });
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('iCloud Notes');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show iCloud Notes', click: () => { if (!mainWindow) createWindow(); mainWindow.show(); } },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { if (!mainWindow) { createWindow(); return; } mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); });
}

app.on('ready', () => { createWindow(); createTray(); });
app.on('window-all-closed', (event) => { if (!isQuitting) event.preventDefault(); });
app.on('before-quit', async () => { await session.fromPartition('persist:icloud').cookies.flushStore(); });
