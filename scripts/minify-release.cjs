#!/usr/bin/env node
/**
 * Stage a minified copy of the app for electron-builder.
 * Run from repo root: node scripts/minify-release.cjs
 * Then: electron-builder --project .release-staging ...
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = process.cwd();
const STAGING = path.join(ROOT, '.release-staging');

const SKIP = new Set([
  'node_modules',
  'dist',
  '.release-staging',
  '.git',
  '.github',
  'docs',
  'eslint.config.mjs',
  'bun.lock',
  'package-lock.json',
  '.gitignore',
  'README.md',
  'LICENSE',
  'icon_backup.png',
]);

function copyIntoStaging(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (SKIP.has(name)) continue;
      copyIntoStaging(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function walk(dir, test, fn) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, test, fn);
    else if (test(full)) fn(full);
  }
}

function minifyHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function jsFormat(file, pkgType) {
  if (file.endsWith('.cjs')) return 'cjs';
  if (file.endsWith('.mjs')) return 'esm';
  return pkgType === 'module' ? 'esm' : 'cjs';
}

async function minifyJs(file, format) {
  const code = fs.readFileSync(file, 'utf8');
  const result = await esbuild.transform(code, {
    loader: 'js',
    minify: true,
    format,
    platform: 'node',
    target: 'node18',
  });
  fs.writeFileSync(file, result.code);
}

async function minifyCss(file) {
  const code = fs.readFileSync(file, 'utf8');
  const result = await esbuild.transform(code, {
    loader: 'css',
    minify: true,
  });
  fs.writeFileSync(file, result.code);
}

function stagingPath(relativePath) {
  return path.join(STAGING, relativePath.replace(/^\.\//, ''));
}

function getElectronVersion(root, pkg) {
  try {
    const electronPkg = JSON.parse(
      fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8')
    );
    return electronPkg.version;
  } catch {
    const raw = pkg.devDependencies?.electron || pkg.dependencies?.electron || '';
    const match = String(raw).match(/(\d+\.\d+\.\d+)/);
    return match?.[1];
  }
}

function fixDependencies(deps, root) {
  if (!deps) return deps;
  const next = { ...deps };
  for (const [name, spec] of Object.entries(next)) {
    if (typeof spec === 'string' && spec.startsWith('file:')) {
      const srcPath = path.resolve(root, spec.slice('file:'.length));
      next[name] = `file:${srcPath}`;
    }
  }
  return next;
}

function fixBuildPaths(build) {
  if (!build) return build;
  const next = { ...build };
  if (typeof next.afterPack === 'string' && next.afterPack.startsWith('.')) {
    next.afterPack = stagingPath(next.afterPack);
  }
  if (next.nsis?.include?.startsWith('.')) {
    next.nsis = { ...next.nsis, include: stagingPath(next.nsis.include) };
  }
  return next;
}

async function main() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  for (const name of fs.readdirSync(ROOT)) {
    if (SKIP.has(name)) continue;
    copyIntoStaging(path.join(ROOT, name), path.join(STAGING, name));
  }

  const stagingPkg = { ...pkg, devDependencies: undefined };
  stagingPkg.dependencies = fixDependencies(stagingPkg.dependencies, ROOT);
  const electronVersion = getElectronVersion(ROOT, pkg);
  stagingPkg.build = fixBuildPaths({
    ...stagingPkg.build,
    compression: 'maximum',
    ...(electronVersion ? { electronVersion } : {}),
    directories: {
      ...stagingPkg.build?.directories,
      output: '../dist',
    },
  });
  fs.writeFileSync(path.join(STAGING, 'package.json'), JSON.stringify(stagingPkg, null, 2) + '\n');

  const pkgType = pkg.type || 'commonjs';
  const jsFiles = [];
  walk(STAGING, (f) => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'), (f) => jsFiles.push(f));

  for (const file of jsFiles) {
    if (file.includes(`${path.sep}scripts${path.sep}`) && !file.includes('after-pack')) continue;
    await minifyJs(file, jsFormat(file, pkgType));
  }

  walk(STAGING, (f) => f.endsWith('.css'), (f) => minifyCss(f));
  walk(STAGING, (f) => f.endsWith('.html'), (f) => {
    fs.writeFileSync(f, minifyHtml(fs.readFileSync(f, 'utf8')));
  });

  console.log(`[minify-release] staged minified app at ${STAGING}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
