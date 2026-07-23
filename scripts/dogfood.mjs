#!/usr/bin/env node
// dogfood.mjs — prove the PACKAGED engine works.
//
// Packs @multilane/{core,cli,http,screen} with `npm pack`, installs those tarballs into a temp copy
// of examples/consumer-smoke (no source imports, no registry), then runs `mlt verify` + the smoke
// suite. Fully offline and deterministic — nothing here pulls from Nexus or npmjs.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['core', 'cli', 'http', 'screen'];

const staging = mkdtempSync(join(tmpdir(), 'mlt-dogfood-'));
const tarDir = join(staging, 'tarballs');
mkdirSync(tarDir, { recursive: true });

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

try {
  // 1) Pack each engine package into the temp tarball dir.
  const tarballs = {};
  for (const p of PACKAGES) {
    const out = execSync(`npm pack -w @multilane/${p} --pack-destination "${tarDir}" --json`, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const filename = JSON.parse(out)[0].filename;
    tarballs[`@multilane/${p}`] = join(tarDir, filename);
  }
  console.log('✓ packed:', Object.keys(tarballs).join(', '));

  // 2) Copy the consumer fixture and repoint its deps at the local tarballs.
  const consumer = join(staging, 'consumer');
  cpSync(join(repo, 'examples', 'consumer-smoke'), consumer, { recursive: true });
  const pkgPath = join(consumer, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const dep of Object.keys(pkg.devDependencies ?? {})) {
    if (tarballs[dep]) pkg.devDependencies[dep] = `file:${tarballs[dep]}`;
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // 3) Install the packaged engine (offline) and run gates + smoke.
  run('npm install --no-audit --no-fund --prefer-offline', consumer);
  run('npx --no-install mlt verify', consumer);
  run('node --test tests/http/*.test.mjs tests/screen/*.test.mjs', consumer);

  console.log('\n✓ dogfood: packaged engine installed from tarballs; gates + smoke suite passed.');
} finally {
  rmSync(staging, { recursive: true, force: true });
}
