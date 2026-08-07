# iCloud Notes for Windows

[![Release](https://img.shields.io/github/v/release/taylorivanoff/icloud-notes-windows)](https://github.com/taylorivanoff/icloud-notes-windows/releases)
[![Downloads](https://img.shields.io/github/downloads/taylorivanoff/icloud-notes-windows/total)](https://github.com/taylorivanoff/icloud-notes-windows/releases)
[![License](https://img.shields.io/github/license/taylorivanoff/icloud-notes-windows)](LICENSE)

iCloud Notes desktop app for Windows. Access iCloud Notes from [icloud.com](https://www.icloud.com/).

## Features

- **System Tray Integration** - Runs in the background, keeping your iCloud session alive
- **Quick Access** - Click the tray icon to show/hide the window
- **Start with Windows** - Automatically launches on startup once signed in
- **Auto-Updates** - Automatically downloads and installs updates
- **Shared Authentication** - Sign in once and stay logged in across all iCloud apps
- **Window State Persistence** - Remembers your window size and position
- **Splash Screen** - Beautiful loading screen while the app starts
- **Lightweight** - Minimal resource usage

## Installation

1. Download the latest installer from [Releases](https://github.com/taylorivanoff/icloud-notes-windows/releases)
2. Run the installer and follow the prompts
3. Sign in with your Apple ID



## Security & authentication

This app is **not affiliated with Apple**. It is an unofficial desktop wrapper that loads the official Apple web experience in a secure Electron window.

### How sign-in works

- You sign in on **Apple’s own websites** inside the app window—the same sign-in and two-factor authentication flow you would use in Safari or Chrome.
- **Your Apple ID password is never collected or stored by this app.** Credentials are entered only on Apple-controlled pages and handled entirely by Apple.
- After sign-in, Apple sets standard **web session cookies**. The app uses those cookies only to keep you logged in and to load your data from Apple’s servers.

### What is stored locally

| Data | Purpose |
|------|---------|
| Session cookies for `icloud.com` and `apple.com` | Stay signed in; **shared across all of these desktop apps** on the same Windows user account |
| Window size, position, and tray preferences | Convenience settings only (not your Apple ID) |

Session cookies are kept in:

- `%APPDATA%\icloud-shared\cookies.json` — shared cookie file used by every app in this family
- Electron’s persistent session partition (`persist:icloud`) — the in-app browser session

Cookies are saved when they change and when the app quits. They are **not** sent to the app author or any third party—only back to Apple when the embedded web view loads Apple services, the same as in a normal browser.

### What the app does not do

- Does not implement its own login form or password database
- Does not send your Apple ID or session to non-Apple servers
- Does not enable Node.js inside the web page (`nodeIntegration: false`)
- Does not read or modify your mail, photos, or other content outside Apple’s own web app

Links you open from the app (for example “Open in browser”) are handed off to your **default system browser** via the OS.

### Updates

Updates are downloaded from **GitHub Releases** using [electron-updater](https://www.electron.build/auto-update). Only the app binary is updated; your Apple sign-in is unchanged.

### Recommendations

- Use a **password-protected Windows account** and **device encryption** (BitLocker). Session cookies on disk are only as secure as your user profile.
- To sign out on this PC, use **Sign Out** in the iCloud or Apple web UI inside the app, or delete `%APPDATA%\icloud-shared\cookies.json` and quit all related apps.
- Install only from **official GitHub releases** for this project.

The shared wrapper ([icloud-windows-base](https://github.com/taylorivanoff/icloud-windows-base)) is open source so you can review how sessions and cookies are handled.
## Development

```bash
bun install
bun run start
```

### Building

```bash
bun run release
```

## Keywords

iCloud Notes for Windows, Apple Notes Windows app, iCloud Notes desktop, iCloud Notes PC client

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

[MIT](LICENSE)
