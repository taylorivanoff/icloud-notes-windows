const { app, BrowserWindow, session, Tray, Menu, nativeImage, shell, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

const store = new Store();
const sharedCookiePath = path.join(app.getPath('appData'), 'icloud-shared', 'cookies.json');
const APP_NAME = 'iCloud Notes';
const PROTOCOL = 'icloud-notes';
const ICLOUD_URL = 'https://www.icloud.com/notes';

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadSharedCookies(ses) {
  try {
    if (fs.existsSync(sharedCookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(sharedCookiePath, 'utf8'));
      for (const cookie of cookies) {
        try { await ses.cookies.set(cookie); } catch (e) { }
      }
    }
  } catch (e) { }
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
  } catch (e) { }
}

function getWindowBounds() {
  const saved = store.get('windowBounds');
  const defaults = { width: 1280, height: 800 };
  if (!saved) return defaults;
  const displays = screen.getAllDisplays();
  const inBounds = displays.some(d => {
    const { x, y, width, height } = d.bounds;
    return saved.x >= x && saved.x < x + width && saved.y >= y && saved.y < y + height;
  });
  return inBounds ? saved : defaults;
}

function saveWindowBounds() {
  if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

let mainWindow, splashWindow, tray, isQuitting = false;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) { app.quit(); }
else {
  app.on('second-instance', (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    handleProtocolUrl(argv.find(a => a.startsWith(`${PROTOCOL}://`)));
  });
}

function handleProtocolUrl(url) {
  if (!url || !mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 300, height: 350, frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false, webPreferences: { nodeIntegration: false }
  });
  splashWindow.loadFile('splash.html');
  splashWindow.center();
}

async function createWindow() {
  if (mainWindow) return;
  const bounds = getWindowBounds();
  mainWindow = new BrowserWindow({
    ...bounds, show: false,
    webPreferences: { nodeIntegration: false, partition: 'persist:icloud' }
  });
  const ses = mainWindow.webContents.session;
  await loadSharedCookies(ses);
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  mainWindow.setMenu(null);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url !== 'about:blank#blocked') shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.loadURL(ICLOUD_URL);
  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow) { splashWindow.destroy(); splashWindow = null; }
    mainWindow.show();
  });
  ses.cookies.on('changed', (event, cookie, cause, removed) => {
    if (cookie.domain?.includes('icloud.com') || cookie.domain?.includes('apple.com')) {
      saveSharedCookies(ses);
      if (!removed && cookie.name === 'X-APPLE-WEBAUTH-LOGIN')
        app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
    }
  });
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Show ${APP_NAME}`, click: () => { if (!mainWindow) createWindow(); mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { if (!mainWindow) { createWindow(); return; } mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); });
}

function setupJumpList() {
  app.setJumpList([]);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => { });
}

app.setAsDefaultProtocolClient(PROTOCOL);

app.on('ready', () => {
  createSplash();
  createWindow();
  createTray();
  setupJumpList();
  setupAutoUpdater();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on('window-all-closed', (event) => { if (!isQuitting) event.preventDefault(); });
app.on('before-quit', async () => { isQuitting = true; const ses = session.fromPartition('persist:icloud'); await saveSharedCookies(ses); await ses.cookies.flushStore(); });
