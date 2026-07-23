#!/usr/bin/env node
// dogfood.mjs — prove the PACKAGED engine works.
//
// Packs every @multilane/* workspace with `npm pack`, installs those tarballs into a temp copy of
// examples/consumer-smoke (no source imports, no registry), then runs `mlt verify` + the smoke
// suite. `overrides` repoints nested @multilane/* dependencies (e.g. screen -> core) at the same
// tarballs, so the install is hermetic and runs with npm's --offline flag — nothing here pulls
// from any registry.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = readdirSync(join(repo, 'packages'));

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
  // Overrides make nested @multilane/* dependencies resolve to the tarballs too, keeping the
  // install hermetic (no packument fetch for workspace-internal deps).
  pkg.overrides = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
  );
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // 3) Install the packaged engine (offline) and run gates + smoke.
  run('npm install --no-audit --no-fund --offline', consumer);
  run('npx --no-install mlt verify', consumer);
  run('node --test "tests/**/*.test.mjs"', consumer);

  // 4) Minimal-entry consumer: install ONLY the documented entry packages (cli + core). When a
  //    lane's authoring package is unresolvable, `mlt create-system` must exit nonzero — a partial
  //    setup reported as success is the failure mode this guards against.
  const minimal = join(staging, 'minimal');
  mkdirSync(minimal, { recursive: true });
  writeFileSync(
    join(minimal, 'package.json'),
    `${JSON.stringify(
      {
        name: 'minimal-entry',
        private: true,
        version: '0.0.0',
        type: 'module',
        devDependencies: {
          '@multilane/cli': `file:${tarballs['@multilane/cli']}`,
          '@multilane/core': `file:${tarballs['@multilane/core']}`,
        },
        overrides: Object.fromEntries(
          Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  run('npm install --no-audit --no-fund --offline', minimal);
  let createSystemFailed = false;
  try {
    execSync('npx --no-install mlt create-system demo --lanes web', { cwd: minimal, stdio: 'pipe' });
  } catch {
    createSystemFailed = true;
  }
  if (!createSystemFailed) {
    throw new Error('create-system must exit nonzero when @multilane/authoring-web is unresolvable.');
  }
  console.log('✓ minimal-entry consumer: create-system exits nonzero when the authoring package is missing.');

  console.log('\n✓ dogfood: packaged engine installed from tarballs; gates + smoke suite passed.');
} finally {
  rmSync(staging, { recursive: true, force: true });
}
