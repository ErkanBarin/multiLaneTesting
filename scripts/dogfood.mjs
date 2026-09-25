#!/usr/bin/env node
// dogfood.mjs — prove the PACKAGED engine works.
//
// Packs every @erkanbarin/* workspace with `npm pack`, installs those tarballs into a temp copy of
// examples/consumer-smoke (no source imports, no registry), then runs `mlt verify` + the smoke
// suite. `overrides` repoints nested @erkanbarin/* dependencies (e.g. screen -> core) at the same
// tarballs. Third-party dependencies may resolve through the configured npm registry.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = readdirSync(join(repo, 'packages'));

const staging = mkdtempSync(join(tmpdir(), 'mlt-dogfood-'));
const tarDir = join(staging, 'tarballs');
mkdirSync(tarDir, { recursive: true });

function run(cmd, cwd, env) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: env ? { ...process.env, ...env } : process.env });
}

try {
  // 1) Pack each engine package into the temp tarball dir.
  const tarballs = {};
  for (const p of PACKAGES) {
    const out = execSync(`npm pack -w @erkanbarin/${p} --pack-destination "${tarDir}" --json`, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const filename = JSON.parse(out)[0].filename;
    tarballs[`@erkanbarin/${p}`] = join(tarDir, filename);
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
  // Overrides make nested @erkanbarin/* dependencies resolve to the tarballs too, keeping the
  // install hermetic (no packument fetch for workspace-internal deps).
  pkg.overrides = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
  );
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  // 3) Install local engine tarballs and resolve third-party dependencies, then run the smoke.
  run('npm install --no-audit --no-fund', consumer);
  run('npx --no-install mlt verify', consumer);
  // Unquoted so the shell expands it: Node 20 (the supported minimum) does not glob --test args.
  run('node --test tests/*/*.test.mjs', consumer);

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
          '@erkanbarin/cli': `file:${tarballs['@erkanbarin/cli']}`,
          '@erkanbarin/core': `file:${tarballs['@erkanbarin/core']}`,
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
    throw new Error('create-system must exit nonzero when @erkanbarin/authoring-web is unresolvable.');
  }
  console.log('✓ minimal-entry consumer: create-system exits nonzero when the authoring package is missing.');

  // 5) Scaffolded consumer: the documented `mlt create-system` flow end to end, offline.
  // The directory name is deliberately hostile (space, quotes, command substitution): the
  // installer must treat the consumer path as data, not shell syntax.
  const scaffoldHome = join(staging, `scaffold home "'$(echo injected)`);
  mkdirSync(scaffoldHome, { recursive: true });
  writeFileSync(
    join(scaffoldHome, 'package.json'),
    `${JSON.stringify(
      {
        name: 'scaffold-home',
        private: true,
        version: '0.0.0',
        type: 'module',
        devDependencies: {
          '@erkanbarin/cli': `file:${tarballs['@erkanbarin/cli']}`,
          '@erkanbarin/core': `file:${tarballs['@erkanbarin/core']}`,
          '@erkanbarin/authoring-http': `file:${tarballs['@erkanbarin/authoring-http']}`,
        },
        overrides: Object.fromEntries(
          Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  run('npm install --no-audit --no-fund --offline', scaffoldHome);
  console.log('$ npx --no-install mlt create-system my-system --lanes http');
  const createOut = execSync('npx --no-install mlt create-system my-system --lanes http', {
    cwd: scaffoldHome,
    encoding: 'utf8',
  });
  console.log(createOut);
  // The CLI's next step is `npm install` from the public registry; the tarball installer stays the
  // documented alternative for unreleased engine changes, and is what this offline run exercises.
  if (!createOut.includes('npm install &&') || !createOut.includes('install-tarballs.mjs')) {
    throw new Error('create-system output must show `npm install` and the install-tarballs.mjs alternative.');
  }
  const project = join(scaffoldHome, 'my-system');
  // The HTTP-only scaffold has no third-party dependencies and stays offline.
  run(`node "${join(repo, 'scripts', 'install-tarballs.mjs')}" my-system`, scaffoldHome, {
    npm_config_offline: 'true',
  });
  if (!existsSync(join(project, 'package-lock.json'))) {
    throw new Error('scaffolded consumer: npm install must create package-lock.json.');
  }
  run('npx --no-install mlt verify', project);
  console.log('✓ scaffolded consumer: create-system → tarball install → lockfile created → verify passed.');

  // 6) Unsupported-path fail-fast: npm mishandles # % \ : in consumer paths (file:-spec/URI
  //    parsing, .bin PATH entries), so the installer must refuse them clearly BEFORE mutating
  //    the project.
  const hashHome = join(staging, 'hash#name');
  mkdirSync(hashHome, { recursive: true });
  writeFileSync(join(hashHome, 'package.json'), '{"name":"hash-consumer","private":true,"version":"0.0.0"}\n');
  let pathRejected = false;
  try {
    execSync(`node "${join(repo, 'scripts', 'install-tarballs.mjs')}" .`, {
      cwd: hashHome,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    pathRejected = true;
    if (!`${err.stdout}${err.stderr}`.includes('contains "#"')) {
      throw new Error(`installer must name the unsupported character; got:\n${err.stdout}${err.stderr}`);
    }
  }
  if (!pathRejected) throw new Error('installer must reject a consumer path containing "#".');
  if (existsSync(join(hashHome, 'vendor'))) {
    throw new Error('installer must reject unsupported paths before creating vendor/.');
  }
  console.log('✓ installer refuses unsupported consumer paths (#) before mutating the project.');

  console.log('\n✓ dogfood: packaged engine installed from tarballs; gates + smoke suite passed.');
} finally {
  rmSync(staging, { recursive: true, force: true });
}
