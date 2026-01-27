const { app, BrowserWindow, session, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isQuitting = false;

// Single instance lock - if another instance tries to start, focus the existing one
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance (e.g. clicked pinned taskbar icon)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  if (mainWindow) {
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      // Use a persistent partition to ensure cookies/session data survive app restarts
      partition: 'persist:icloud',
    }
  });

  // Get the persistent session for this window
  const ses = mainWindow.webContents.session;

  // Specify user agent so "download iCloud for Windows" banner doesn't appear
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15";
    callback({
      cancel: false,
      requestHeaders: details.requestHeaders
    });
  });

  // Hide default top menu
  mainWindow.setMenu(null);

  // Make links set to open a new tab and window.open() open in the default browser instead of a new application window
  mainWindow.webContents.on("new-window", function (event, url) {
    event.preventDefault();
    if (url !== "about:blank#blocked") shell.openExternal(url);
  });

  mainWindow.loadURL('https://www.icloud.com/notes');

  // Listen for authentication-related cookies
  ses.cookies.on('changed', (event, cookie, cause, removed) => {
    if (!removed && cookie.domain && cookie.domain.includes('.icloud.com')) {
      // When we see a valid auth token, configure the app to start with Windows
      if (cookie.name === 'X-APPLE-WEBAUTH-TOKEN') {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: process.execPath,
        });
      }
    }
  });

  // Hide instead of quitting so the session stays alive
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show iCloud Notes',
      click: () => {
        if (!mainWindow) {
          createWindow();
        }
        mainWindow.show();
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('iCloud Notes');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

app.on('ready', () => {
  createWindow();
  createTray();
});

// On Windows we want to quit when explicitly told to, not when the last window is closed
app.on('window-all-closed', (event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

// Flush cookies to disk before quitting to maximize session persistence
app.on('before-quit', async () => {
  const ses = session.fromPartition('persist:icloud');
  await ses.cookies.flushStore();
});
