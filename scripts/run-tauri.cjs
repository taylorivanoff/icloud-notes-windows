/**
 * Ensure cargo + MSVC link.exe are on PATH, then run `tauri <args>`.
 * During `dev`, starts a local static server with live reload.
 */
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function prependPath(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const parts = (process.env.PATH || '').split(path.delimiter);
  if (!parts.includes(dir)) {
    process.env.PATH = `${dir}${path.delimiter}${process.env.PATH || ''}`;
  }
}

function which(cmd) {
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'where.exe' : 'which',
      [cmd],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return out.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function applyVcVars() {
  if (process.platform !== 'win32') return;
  if (which('link.exe')) return;

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  if (!fs.existsSync(vswhere)) return;

  let installPath = '';
  try {
    installPath = execFileSync(
      vswhere,
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath'
      ],
      { encoding: 'utf8' }
    ).trim();
  } catch {
    return;
  }
  if (!installPath) return;

  const vcvars = path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  if (!fs.existsSync(vcvars)) return;

  const helper = path.join(
    os.tmpdir(),
    `tauri-vcvars-${process.pid}-${Date.now()}.cmd`
  );
  fs.writeFileSync(
    helper,
    [
      '@echo off',
      `call "${vcvars}" >nul`,
      'if errorlevel 1 exit /b 1',
      'set'
    ].join('\r\n'),
    'utf8'
  );

  try {
    const dumped = execFileSync('cmd.exe', ['/d', '/c', helper], {
      encoding: 'utf8',
      windowsHide: true
    });
    for (const line of dumped.split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i <= 0) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (
        key === 'PATH' ||
        key.startsWith('INCLUDE') ||
        key.startsWith('LIB') ||
        key.startsWith('VC') ||
        key.startsWith('WindowsSDK') ||
        key === 'LIBPATH'
      ) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('[run-tauri] could not load MSVC env via vcvars64:', err.message);
  } finally {
    try {
      fs.unlinkSync(helper);
    } catch {
      /* ignore */
    }
  }
}

function findSharedScript(name) {
  const local = path.join(__dirname, name);
  if (fs.existsSync(local)) return local;

  let dir = path.dirname(__dirname);
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, 'scripts', name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readTauriConfig(appRoot) {
  const configPath = path.join(appRoot, 'src-tauri', 'tauri.conf.json');
  if (!fs.existsSync(configPath)) return { configPath, config: {} };
  return {
    configPath,
    config: JSON.parse(fs.readFileSync(configPath, 'utf8'))
  };
}

function mergeTauriConfig(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeTauriConfig(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function applyDevHotReload(appRoot) {
  const { config } = readTauriConfig(appRoot);
  if (config.build?.devUrl) return null;

  const frontendDist = config.build?.frontendDist || '../src';
  const rootDir = path.resolve(path.join(appRoot, 'src-tauri', frontendDist));
  const devServerPath = findSharedScript('tauri-dev-server.cjs');
  if (!devServerPath) {
    console.warn('[run-tauri] tauri-dev-server.cjs not found — hot reload disabled');
    return null;
  }

  const { startDevServer } = require(devServerPath);
  const devServer = startDevServer({ rootDir });

  const existing = process.env.TAURI_CONFIG
    ? JSON.parse(process.env.TAURI_CONFIG)
    : {};
  process.env.TAURI_CONFIG = JSON.stringify(
    mergeTauriConfig(existing, {
      build: { devUrl: '__TAURI_DEV_URL__' },
      app: { security: { devCsp: null } }
    })
  );

  return {
    devServer,
    async applyDevUrl() {
      const { url } = await devServer.ready;
      const merged = JSON.parse(process.env.TAURI_CONFIG);
      merged.build.devUrl = url;
      process.env.TAURI_CONFIG = JSON.stringify(merged);
      return url;
    },
    async close() {
      await devServer.close();
    }
  };
}

applyVcVars();
prependPath(path.join(os.homedir(), '.cargo', 'bin'));

if (!which('cargo')) {
  console.error(
    'cargo not found. Install Rust from https://rustup.rs and open a new terminal, or ensure %USERPROFILE%\\.cargo\\bin is on PATH.'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const appRoot = path.join(__dirname, '..');
const tauriCli = path.join(appRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

function hasUpdaterSigningKey() {
  if (process.env.TAURI_SIGNING_PRIVATE_KEY) return true;
  const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  return Boolean(keyPath && fs.existsSync(keyPath));
}

const isDev = args[0] === 'dev';
const isBuild = args[0] === 'build';
let tempConfigPath = null;
const finalArgs = [...args];

if (isBuild && !hasUpdaterSigningKey()) {
  console.warn(
    '[run-tauri] TAURI_SIGNING_PRIVATE_KEY not set — building installer only (no updater signatures).'
  );
  tempConfigPath = path.join(
    os.tmpdir(),
    `tauri-nosign-${process.pid}-${Date.now()}.json`
  );
  fs.writeFileSync(
    tempConfigPath,
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
    'utf8'
  );
  finalArgs.push('--config', tempConfigPath);
}

async function main() {
  let hotReload = null;
  if (isDev) {
    hotReload = applyDevHotReload(appRoot);
    if (hotReload) {
      await hotReload.applyDevUrl();
    }
  }

  const result = spawnSync(process.execPath, [tauriCli, ...finalArgs], {
    stdio: 'inherit',
    env: process.env,
    shell: false
  });

  if (hotReload) {
    await hotReload.close();
  }

  if (tempConfigPath) {
    try {
      fs.unlinkSync(tempConfigPath);
    } catch {
      /* ignore */
    }
  }

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('[run-tauri] failed:', err);
  process.exit(1);
});
