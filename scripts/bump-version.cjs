/**
 * Bump version in package.json (source of truth).
 * Cargo.toml is synced because Cargo requires its own version field.
 * tauri.conf.json reads version from ../package.json.
 * Usage: node scripts/bump-version.cjs [patch|minor|major]
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

function syncCargoVersion(version) {
  const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return;
  const cargo = fs.readFileSync(cargoPath, 'utf8');
  const next = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
  if (next !== cargo) {
    fs.writeFileSync(cargoPath, next);
  }
}

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const next = bump(pkg.version, kind);
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
syncCargoVersion(next);

console.log(`bumped to ${next}`);
