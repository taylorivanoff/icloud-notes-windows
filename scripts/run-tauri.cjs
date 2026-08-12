/**
 * Ensure cargo + MSVC link.exe are on PATH, then run `tauri <args>`.
 * Fixes shells opened before rustup / Build Tools were installed.
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
  // Temp .cmd avoids Node/cmd quote mangling for paths with spaces.
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

applyVcVars();
prependPath(path.join(os.homedir(), '.cargo', 'bin'));

if (!which('cargo')) {
  console.error(
    'cargo not found. Install Rust from https://rustup.rs and open a new terminal, or ensure %USERPROFILE%\\.cargo\\bin is on PATH.'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const tauriCli = path.join(
  __dirname,
  '..',
  'node_modules',
  '@tauri-apps',
  'cli',
  'tauri.js'
);

const result = spawnSync(process.execPath, [tauriCli, ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: false
});

process.exit(result.status ?? 1);
