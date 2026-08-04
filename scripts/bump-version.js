#!/usr/bin/env node
/**
 * Bump package.json version, commit, and push to master.
 * Triggers the existing GitHub Actions release workflow.
 *
 * Usage:
 *   node scripts/bump-version.js [patch|minor|major]
 *   npm run bump
 *   npm run bump -- minor
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const level = (process.argv[2] || 'patch').toLowerCase();

if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`Invalid bump level "${level}". Use patch, minor, or major.`);
  process.exit(1);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function runCapture(cmd) {
  return run(cmd, { silent: true }).trim();
}

const branch = runCapture('git rev-parse --abbrev-ref HEAD');
if (branch !== 'master' && branch !== 'main') {
  console.error(`Must be on master/main (currently on ${branch}).`);
  process.exit(1);
}

const status = runCapture('git status --porcelain');
if (status) {
  console.error('Working tree is not clean. Commit or stash changes first, then bump.');
  console.error(status);
  process.exit(1);
}

runCapture('git fetch origin');
const behind = runCapture(`git rev-list --count HEAD..origin/${branch}`);
if (behind !== '0') {
  console.error(`Local ${branch} is behind origin/${branch}. Pull first.`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
run(`npm version ${level} --no-git-tag-version`);
const newVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

const toAdd = ['package.json'];
for (const lock of ['package-lock.json', 'bun.lock', 'bun.lockb', 'yarn.lock']) {
  if (fs.existsSync(path.join(root, lock))) toAdd.push(lock);
}

run(`git add -- ${toAdd.join(' ')}`);
run(`git commit -m "chore: bump version to ${newVersion}"`);
run(`git push origin ${branch}`);

console.log(`\nBumped ${oldVersion} → ${newVersion} and pushed to ${branch}.`);
console.log('GitHub Actions will build and publish the release if the version changed.');
