/**
 * Zero-dependency static dev server with live reload for Tauri apps.
 * Used by scripts/run-tauri.cjs during `tauri dev`.
 */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

const RELOAD_SNIPPET =
  '<script>(function(){var v=0;setInterval(function(){fetch("/__tauri_dev__/version").then(function(r){return r.json()}).then(function(j){if(v&&j.v!==v)location.reload();v=j.v}).catch(function(){})},300)})();</script>';

function startDevServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const host = options.host || '127.0.0.1';
  const requestedPort = Number(options.port || process.env.TAURI_DEV_PORT || 1420);

  if (!fs.existsSync(rootDir)) {
    throw new Error(`[tauri-dev-server] frontend dir not found: ${rootDir}`);
  }

  let version = 0;
  let debounce = null;
  const watchers = [];

  function bump() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      version += 1;
    }, 80);
  }

  function watchDir(dir) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (!filename) return bump();
        const base = path.basename(filename);
        if (base === '.DS_Store' || base.startsWith('.')) return;
        bump();
      });
      watchers.push(watcher);
    } catch (err) {
      console.warn(`[tauri-dev-server] could not watch ${dir}:`, err.message);
    }
  }

  watchDir(rootDir);

  function safePath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const rel = decoded.replace(/^\/+/, '');
    const abs = path.resolve(rootDir, rel);
    if (abs !== rootDir && !abs.startsWith(rootDir + path.sep)) return null;
    return abs;
  }

  function injectReload(html) {
    if (html.includes('__tauri_dev__/version')) return html;
    const lower = html.toLowerCase();
    const bodyIdx = lower.lastIndexOf('</body>');
    if (bodyIdx >= 0) {
      return html.slice(0, bodyIdx) + RELOAD_SNIPPET + html.slice(bodyIdx);
    }
    return html + RELOAD_SNIPPET;
  }

  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/';

    if (urlPath.startsWith('/__tauri_dev__/version')) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ v: version }));
      return;
    }

    let abs = safePath(urlPath);
    if (!abs) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      let stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        abs = path.join(abs, 'index.html');
        stat = fs.statSync(abs);
      }
      if (!stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }

      const ext = path.extname(abs).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      res.setHeader('Cache-Control', 'no-store');

      if (ext === '.html' || ext === '.htm') {
        const html = injectReload(fs.readFileSync(abs, 'utf8'));
        res.writeHead(200, { 'Content-Type': type });
        res.end(html);
        return;
      }

      res.writeHead(200, { 'Content-Type': type });
      fs.createReadStream(abs).pipe(res);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });

  function listen(port) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.removeListener('error', reject);
        resolve(port);
      });
    });
  }

  let ready = (async () => {
    let port = requestedPort;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        port = await listen(port);
        break;
      } catch (err) {
        if (err.code !== 'EADDRINUSE') throw err;
        port += 1;
      }
    }
    const url = `http://${host}:${port}`;
    console.log(`[tauri-dev-server] serving ${rootDir}`);
    console.log(`[tauri-dev-server] live reload at ${url}`);
    return { url, port };
  })();

  return {
    ready,
    close() {
      for (const watcher of watchers) {
        try {
          watcher.close();
        } catch {
          /* ignore */
        }
      }
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
  };
}

module.exports = { startDevServer };
