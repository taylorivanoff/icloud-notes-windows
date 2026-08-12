/**
 * Bump patch version across package.json, Cargo.toml, and tauri.conf.json.
 * Usage: node scripts/bump-version.js [patch|minor|major]
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const kind = process.argv[2] || 'patch';

function bump(ver, kind) {
  const [maj, min, pat] = ver.split('.').map((n) => parseInt(n, 10));
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const next = bump(pkg.version, kind);
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = ".*"$/m, `version = "${next}"`);
fs.writeFileSync(cargoPath, cargo);

const confPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
conf.version = next;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

console.log(`bumped to ${next}`);
