import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadConfig,
  assertTestPartition,
  loadProjectConfig,
  runNoRuntimeAiGate,
  runRobotContractGate,
  runScreenPartitionGate,
  runVerify,
} from '../index.mjs';

function tmpProject() {
  return mkdtempSync(join(tmpdir(), 'mlt-core-'));
}

test('loadConfig applies documented defaults with no host literals', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.screen.partition, 'TEST_A');
  assert.equal(cfg.screen.display, ':99');
  assert.equal(cfg.http.enabled, false);
  assert.equal(cfg.ws.inject, false);
  assert.deepEqual(cfg.http.approvedHosts, []);
});

test('assertTestPartition rejects the operational partition', () => {
  const cfg = loadConfig({ SCREEN_RPS_PARTITION: 'PROD' });
  assert.throws(() => assertTestPartition(cfg), /PROD/);
  const ok = loadConfig({ SCREEN_RPS_PARTITION: 'TEST_B' });
  assert.equal(assertTestPartition(ok), 'TEST_B');
});

test('no-runtime-ai gate flags a runtime model import but exempts authoring/', () => {
  const root = tmpProject();
  mkdirSync(join(root, 'tests'), { recursive: true });
  mkdirSync(join(root, 'authoring'), { recursive: true });
  writeFileSync(join(root, 'tests', 'bad.mjs'), "import anthropic from 'anthropic';\n");
  writeFileSync(join(root, 'authoring', 'ok.mjs'), "import anthropic from 'anthropic';\n");

  const res = runNoRuntimeAiGate({ cwd: root });
  assert.equal(res.ok, false);
  assert.ok(res.violations.length >= 1);
  // Every violation is in the runtime file; the authoring copy is exempt.
  assert.ok(res.violations.every((v) => /tests[/\\]bad\.mjs/.test(v.path)));
  assert.ok(!res.violations.some((v) => v.path.includes('authoring')));
});

test('no-runtime-ai gate passes clean runtime code', () => {
  const root = tmpProject();
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'tests', 'good.mjs'), "export const ok = true;\n");
  const res = runNoRuntimeAiGate({ cwd: root });
  assert.equal(res.ok, true);
  assert.equal(res.scanned, 1);
});

test('no-runtime-ai gate fails instead of passing vacuously when it scans zero files', () => {
  const res = runNoRuntimeAiGate({ cwd: tmpProject() });
  assert.equal(res.scanned, 0);
  assert.equal(res.ok, false);
});

// Mutation test for this repo's own gate wiring: prove that a forbidden import dropped into any
// runtime workspace is caught by the runtimeDirs/authoringDirs committed in multilane.config.json.
test('repo gate config catches a forbidden import in every runtime workspace', () => {
  const repoConfig = JSON.parse(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../multilane.config.json'), 'utf8'),
  );
  const runtimeWorkspaces = ['core/src', 'http', 'stomp', 'screen', 'web', 'playwright-config', 'cli/src'];
  for (const workspace of runtimeWorkspaces) {
    const root = tmpProject();
    mkdirSync(join(root, 'packages', workspace), { recursive: true });
    writeFileSync(join(root, 'packages', workspace, 'evil.mjs'), "import openai from 'openai';\n");
    const res = runNoRuntimeAiGate({
      cwd: root,
      runtimeDirs: repoConfig.runtimeDirs,
      authoringDirs: repoConfig.authoringDirs,
    });
    assert.equal(res.ok, false, `forbidden import in packages/${workspace} must fail the gate`);
    assert.ok(res.violations.some((v) => v.path.includes('evil.mjs')));
  }
  // …and the same import inside an exempt authoring package stays exempt (but the scan still fails
  // vacuously because no runtime file exists in this fixture).
  const root = tmpProject();
  mkdirSync(join(root, 'packages', 'authoring-web'), { recursive: true });
  writeFileSync(join(root, 'packages', 'authoring-web', 'assist.mjs'), "import openai from 'openai';\n");
  const res = runNoRuntimeAiGate({
    cwd: root,
    runtimeDirs: repoConfig.runtimeDirs,
    authoringDirs: repoConfig.authoringDirs,
  });
  assert.equal(res.violations.length, 0);
});

test('robot-contract gate rejects an unlisted spec tag and accepts a wired one', () => {
  const root = tmpProject();
  mkdirSync(join(root, 'tests'), { recursive: true });
  mkdirSync(join(root, 'docs', 'ci'), { recursive: true });
  writeFileSync(join(root, 'tests', 'a.spec.ts'), "test('does a thing @samplePanelCrud', () => {});\n");

  const unlisted = runRobotContractGate({ cwd: root, tags: [] });
  assert.equal(unlisted.ok, false);

  writeFileSync(join(root, 'docs', 'ci', 'robot-orchestration.md'), 'Supported: @samplePanelCrud\n');
  const wired = runRobotContractGate({ cwd: root, tags: ['@samplePanelCrud'] });
  assert.equal(wired.ok, true);
  assert.deepEqual(wired.specTags, ['@samplePanelCrud']);
});

test('loadProjectConfig falls back to defaults when no file is present', () => {
  const root = tmpProject();
  const project = loadProjectConfig(root);
  assert.deepEqual(project.robotTags, []);
  assert.equal(project.specDir, 'tests');
});

test('runVerify fails an empty project — a zero-file AI scan is not enforcement', () => {
  const root = tmpProject();
  const res = runVerify({ cwd: root });
  assert.equal(res.ok, false);
  assert.equal(res.gates.length, 3);
  const aiGate = res.gates.find((g) => g.name === 'no-runtime-ai');
  assert.equal(aiGate.ok, false);
  assert.match(aiGate.detail, /0 runtime files scanned/);
});

test('screen-partition guard is a no-op when the screen lane is not active', () => {
  const res = runScreenPartitionGate({ env: { SCREEN_RPS_PARTITION: 'PROD' }, lanes: [] });
  assert.equal(res.active, false);
  assert.equal(res.ok, true);
});

test('screen-partition guard refuses PROD when the screen lane is declared active', () => {
  const res = runScreenPartitionGate({ env: { SCREEN_RPS_PARTITION: 'PROD' }, lanes: ['screen'] });
  assert.equal(res.active, true);
  assert.equal(res.ok, false);
  assert.match(res.error, /PROD/);
});

test('screen-partition guard refuses PROD when only SCREEN_TARGET_HOST signals the lane is active', () => {
  const res = runScreenPartitionGate({
    env: { SCREEN_TARGET_HOST: 'target-host', SCREEN_RPS_PARTITION: 'PROD' },
    lanes: [],
  });
  assert.equal(res.active, true);
  assert.equal(res.ok, false);
});

test('screen-partition guard passes a test partition for an active screen lane', () => {
  const res = runScreenPartitionGate({ env: { SCREEN_RPS_PARTITION: 'TEST_B' }, lanes: ['screen'] });
  assert.equal(res.active, true);
  assert.equal(res.ok, true);
  assert.equal(res.partition, 'TEST_B');
});

test('runVerify hard-fails when the screen lane is active and the partition resolves to PROD', () => {
  const root = tmpProject();
  writeFileSync(join(root, 'multilane.config.json'), JSON.stringify({ lanes: ['screen'] }));
  const res = runVerify({ cwd: root, env: { SCREEN_RPS_PARTITION: 'PROD' } });
  assert.equal(res.ok, false);
  const screenGate = res.gates.find((g) => g.name === 'screen-partition');
  assert.equal(screenGate.ok, false);
  assert.match(screenGate.detail, /PROD/);
});
