const { app, BrowserWindow, session, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const sharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadSharedCookies(ses) {
  try {
    if (fs.existsSync(sharedCookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(sharedCookiePath, 'utf8'));
      for (const cookie of cookies) {
        try { await ses.cookies.set(cookie); } catch (e) {}
      }
    }
  } catch (e) {}
}

async function saveSharedCookies(ses) {
  try {
    const icloudCookies = await ses.cookies.get({ domain: 'icloud.com' });
    const appleCookies = await ses.cookies.get({ domain: 'apple.com' });
    const allCookies = [...icloudCookies, ...appleCookies];
    const cookiesToSave = allCookies.map(c => ({
      url: `https://${c.domain.replace(/^\./, '')}${c.path}`,
      name: c.name, value: c.value, domain: c.domain, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, expirationDate: c.expirationDate,
      sameSite: c.sameSite || 'lax'
    }));
    ensureDir(sharedCookiePath);
    fs.writeFileSync(sharedCookiePath, JSON.stringify(cookiesToSave, null, 2));
  } catch (e) {}
}

let mainWindow, tray, isQuitting = false;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); if (!mainWindow.isVisible()) mainWindow.show(); mainWindow.focus(); }
  });
}

async function createWindow() {
  if (mainWindow) return;
  mainWindow = new BrowserWindow({ width: 1920, height: 1080, webPreferences: { nodeIntegration: true, partition: 'persist:icloud' } });
  const ses = mainWindow.webContents.session;
  await loadSharedCookies(ses);
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15";
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.on("new-window", (event, url) => { event.preventDefault(); if (url !== "about:blank#blocked") shell.openExternal(url); });
  mainWindow.loadURL('https://www.icloud.com/notes');
  ses.cookies.on('changed', (event, cookie, cause, removed) => {
    if (cookie.domain?.includes('icloud.com') || cookie.domain?.includes('apple.com')) {
      saveSharedCookies(ses);
      if (!removed && cookie.name === 'X-APPLE-WEBAUTH-LOGIN')
        app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
    }
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
app.on('before-quit', async () => { const ses = session.fromPartition('persist:icloud'); await saveSharedCookies(ses); await ses.cookies.flushStore(); });
