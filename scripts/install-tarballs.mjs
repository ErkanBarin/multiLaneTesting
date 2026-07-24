#!/usr/bin/env node
// install-tarballs.mjs — install the (unpublished) engine into a consumer project.
//
// Usage: node <engine-repo>/scripts/install-tarballs.mjs <project-dir>
//
// No registry serves @multilane/* yet, so this packs every engine workspace with `npm pack` into
// <project>/vendor/multilane/, rewrites the project's @multilane/* dependencies to those tarballs
// (with `overrides` so nested engine deps like screen -> core stay local), then runs the first
// `npm install`, which creates the consumer's package-lock.json. Commit the lockfile (and
// vendor/multilane/) so the consumer's CI can run `npm ci` without this script.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') {
  console.error(
    '✖ install-tarballs.mjs supports POSIX platforms only: npm is invoked without a shell, and the\n' +
      '  Windows npm launcher is a .cmd shim that execFile cannot run. Use WSL.',
  );
  process.exit(1);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] && resolve(process.argv[2]);
if (!target || !existsSync(join(target, 'package.json'))) {
  console.error('Usage: node scripts/install-tarballs.mjs <project-dir>  (dir must contain a package.json)');
  process.exit(1);
}

// Fail fast BEFORE mutating anything: npm mishandles these characters in the consumer's absolute
// path (# truncates as a URL fragment, % fails URI decoding, \ is rewritten to /, and : breaks
// the node_modules/.bin PATH entry), so a clear refusal beats a half-installed project.
const bad = target.match(/[#%\\:]/);
if (bad) {
  console.error(`✖ project path contains "${bad[0]}", which npm cannot handle in file: specs: ${target}`);
  console.error('  Move/rename the project so its path avoids # % \\ : and rerun.');
  process.exit(1);
}

const vendor = join(target, 'vendor', 'multilane');
mkdirSync(vendor, { recursive: true });

const tarballs = {};
for (const p of readdirSync(join(repo, 'packages'))) {
  // Argument-vector execution: the consumer path is data, never shell syntax — spaces, quotes,
  // and metacharacters in the target directory must not change or inject commands.
  const out = execFileSync('npm', ['pack', '-w', `@multilane/${p}`, '--pack-destination', vendor, '--json'], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  // file: paths relative to the consumer's package.json keep the project portable/committable.
  tarballs[`@multilane/${p}`] = `file:vendor/multilane/${JSON.parse(out)[0].filename}`;
}
console.log('✓ packed into vendor/multilane/:', Object.keys(tarballs).join(', '));

const pkgPath = join(target, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
for (const field of ['dependencies', 'devDependencies']) {
  for (const dep of Object.keys(pkg[field] ?? {})) {
    if (tarballs[dep]) pkg[field][dep] = tarballs[dep];
  }
}
pkg.overrides = { ...pkg.overrides, ...tarballs };
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// The scaffold's .npmrc expands ${NPM_REGISTRY_*}; npm refuses to run while they are unset. The
// engine packages install from the local tarballs, so an unreachable loopback placeholder is safe
// when no real registry is configured — only non-@multilane dependencies (e.g. @playwright/test)
// ever contact a registry, through npm's normal defaults. Values already in the environment win.
const env = {
  NPM_REGISTRY_URL: 'http://127.0.0.1:9/',
  NPM_REGISTRY_AUTH_HOST: '//127.0.0.1:9/',
  NPM_REGISTRY_AUTH_TOKEN: 'offline-unused',
  ...process.env,
};
console.log('$ npm install --no-audit --no-fund');
execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: target, stdio: 'inherit', env });

console.log('\n✓ engine installed from tarballs; package-lock.json created.');
console.log('  Commit package-lock.json and vendor/multilane/ so CI can run `npm ci`.');
