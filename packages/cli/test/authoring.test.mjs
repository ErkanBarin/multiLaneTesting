// @multilane/cli — authoring toolkit tests.
//
// Uses temporary FIXTURE projects (never the engine checkout itself) to prove the installer works
// exactly the way a real consumer would experience it: resolution through `node_modules`, no
// sibling engine checkout, no engine-relative `docs/memory` or `locators/` access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  cpSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  installAuthoring,
  checkAuthoring,
  updateAuthoring,
  describeConfigure,
  PROVENANCE_PATH,
} from '../index.mjs';
import { loadLaneManifest } from '@multilane/authoring-web';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_AUTHORING_WEB = join(HERE, '../../authoring-web');

function tmpFixture(prefix = 'mlt-authoring-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeFixtureProject(root, { lanes = [] } = {}) {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture-project', version: '0.0.0' }, null, 2));
  if (lanes.length) {
    writeFileSync(join(root, 'multilane.config.json'), JSON.stringify({ lanes }, null, 2));
  }
}

/** Copy (never symlink into the real package for mutation tests) the real authoring-web package
 * into the fixture's node_modules, proving standard Node resolution — no engine checkout needed. */
function installFixtureAuthoringWeb(root, { via = 'copy' } = {}) {
  const target = join(root, 'node_modules', '@multilane', 'authoring-web');
  mkdirSync(dirname(target), { recursive: true });
  if (via === 'symlink') {
    symlinkSync(REAL_AUTHORING_WEB, target, 'dir');
  } else {
    cpSync(REAL_AUTHORING_WEB, target, { recursive: true });
  }
  return target;
}

function writeMcpConfig(root, servers) {
  mkdirSync(join(root, '.vscode'), { recursive: true });
  writeFileSync(join(root, '.vscode', 'mcp.json'), JSON.stringify({ servers }, null, 2));
}

// --- 1. lane manifest validation ---

test('lane manifest has the required deterministic shape', () => {
  const manifest = loadLaneManifest();
  assert.equal(manifest.lane, 'web');
  assert.equal(manifest.runtimePackage, '@multilane/web');
  assert.equal(manifest.authoringPackage, '@multilane/authoring-web');
  assert.ok(manifest.compatibility.minRuntimeVersion);
  assert.ok(Array.isArray(manifest.skills) && manifest.skills.length >= 1);
  assert.ok(Array.isArray(manifest.agents) && manifest.agents.length >= 1);
  assert.ok(Array.isArray(manifest.requiredTools));
  assert.ok(Array.isArray(manifest.optionalMcpServers));
  const skill = manifest.skills[0];
  assert.ok(skill.id && skill.source && skill.targets.claude);
  const agent = manifest.agents[0];
  assert.ok(agent.requires.mcpServers.includes('playwright'));
});

// --- 2. Web-only installation ---

test('installs the web lane only (always-on skill enabled, optional agent reported not-enabled)', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);

  const { ok, laneReports } = installAuthoring({ lanes: ['web'], cwd: root });
  assert.equal(ok, true);
  assert.equal(laneReports.length, 1);
  const [report] = laneReports;
  assert.equal(report.status, 'installed');
  assert.deepEqual(report.enabled, ['web-test-authoring']);
  assert.equal(report.notEnabled.length, 1);
  assert.equal(report.notEnabled[0].id, 'ui-explorer');
  assert.match(report.notEnabled[0].reason, /Playwright MCP configuration was not detected/);

  assert.ok(existsSync(join(root, '.claude/skills/web-test-authoring/SKILL.md')));
  assert.ok(existsSync(join(root, '.github/prompts/web-test-authoring.prompt.md')));
  assert.ok(!existsSync(join(root, '.claude/agents/ui-explorer.md')));
  assert.ok(existsSync(join(root, PROVENANCE_PATH)));
});

// --- 3. screen-only installation (recognized lane, no authoring package yet) ---

test('screen-only installation reports the lane as not-yet-available without erroring', () => {
  const root = tmpFixture();
  writeFixtureProject(root);

  const { ok, laneReports } = installAuthoring({ lanes: ['screen'], cwd: root });
  assert.equal(ok, true);
  assert.equal(laneReports.length, 1);
  assert.equal(laneReports[0].status, 'unavailable');
  assert.match(laneReports[0].detail, /No authoring package yet for lane "screen"/);
  assert.equal(existsSync(join(root, PROVENANCE_PATH)), false);
});

// --- 4. Web plus screen installation ---

test('web plus screen installs web and reports screen unavailable in the same call', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);

  const { ok, laneReports } = installAuthoring({ lanes: ['web', 'screen'], cwd: root });
  assert.equal(ok, true);
  const byLane = Object.fromEntries(laneReports.map((r) => [r.lane, r]));
  assert.equal(byLane.web.status, 'installed');
  assert.equal(byLane.screen.status, 'unavailable');
});

// --- 5. no-lane selection ---

test('no lanes selected throws', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  assert.throws(() => installAuthoring({ lanes: [], cwd: root }), /Select at least one lane/);
});

// --- 6. unknown lane ---

test('unknown lane throws and lists known lanes', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  assert.throws(() => installAuthoring({ lanes: ['carrier-pigeon'], cwd: root }), /Unknown lane "carrier-pigeon"/);
});

// --- 7. duplicate lane input ---

test('duplicate lane input is deduplicated to a single lane report', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  const { laneReports } = installAuthoring({ lanes: ['web', 'web', 'web'], cwd: root });
  assert.equal(laneReports.length, 1);
});

// --- 8 & 9. prerequisite present / missing ---

test('prerequisite-present: configured Playwright MCP enables the optional agent', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  writeMcpConfig(root, { playwright: { command: 'npx', args: ['@playwright/mcp'] } });

  const { laneReports } = installAuthoring({ lanes: ['web'], cwd: root });
  assert.deepEqual(laneReports[0].enabled.sort(), ['ui-explorer', 'web-test-authoring']);
  assert.equal(laneReports[0].notEnabled.length, 0);
  assert.ok(existsSync(join(root, '.claude/agents/ui-explorer.md')));
  assert.ok(existsSync(join(root, '.github/agents/ui-explorer-worker.agent.md')));
});

test('prerequisite-missing: optional agent is skipped with a clear reason and configure command', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);

  const { laneReports } = installAuthoring({ lanes: ['web'], cwd: root });
  const notEnabled = laneReports[0].notEnabled[0];
  assert.equal(notEnabled.configureId, 'web-explorer');
  const instructions = describeConfigure('web-explorer', { cwd: root });
  assert.match(instructions, /playwright/);
  assert.match(instructions, /mlt authoring install --lanes web/);
});

// --- 10 & 11. deterministic / unchanged reinstall ---

test('unchanged reinstall produces a byte-identical provenance file', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);

  installAuthoring({ lanes: ['web'], cwd: root });
  const first = readFileSync(join(root, PROVENANCE_PATH), 'utf8');
  installAuthoring({ lanes: ['web'], cwd: root });
  const second = readFileSync(join(root, PROVENANCE_PATH), 'utf8');
  assert.equal(first, second);
});

test('two independent fixtures produce identical asset digests (deterministic installation)', () => {
  const rootA = tmpFixture();
  const rootB = tmpFixture();
  writeFixtureProject(rootA);
  writeFixtureProject(rootB);
  installFixtureAuthoringWeb(rootA);
  installFixtureAuthoringWeb(rootB);

  installAuthoring({ lanes: ['web'], cwd: rootA });
  installAuthoring({ lanes: ['web'], cwd: rootB });
  const a = JSON.parse(readFileSync(join(rootA, PROVENANCE_PATH), 'utf8'));
  const b = JSON.parse(readFileSync(join(rootB, PROVENANCE_PATH), 'utf8'));
  assert.deepEqual(a.lanes.web.assets, b.lanes.web.assets);
});

// --- 12. modified installed file ---

test('check detects a modified installed file', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  const skillPath = join(root, '.claude/skills/web-test-authoring/SKILL.md');
  writeFileSync(skillPath, readFileSync(skillPath, 'utf8') + '\n<!-- tampered -->\n');

  const result = checkAuthoring({ cwd: root });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.type === 'modified-file'));
});

// --- 13. deleted file ---

test('check detects a deleted installed file', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  rmSync(join(root, '.github/prompts/web-test-authoring.prompt.md'));

  const result = checkAuthoring({ cwd: root });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.type === 'deleted-file'));
});

// --- 14. unexpected extra file ---

test('check detects an unexpected extra file in a managed asset directory', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  writeFileSync(join(root, '.claude/skills/web-test-authoring/NOTES.md'), '# not installed by mlt\n');

  const result = checkAuthoring({ cwd: root });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.type === 'extra-file'));
});

// --- 15. missing provenance ---

test('check reports missing provenance when nothing was ever installed', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  const result = checkAuthoring({ cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].type, 'missing-provenance');
});

// --- 16. stale package version ---

test('check detects a package-version drift and update() refreshes it', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  const pkgDir = installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  pkgJson.version = '0.2.0';
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  const drift = checkAuthoring({ cwd: root });
  assert.ok(drift.issues.some((i) => i.type === 'package-version-drift'));

  updateAuthoring({ lanes: ['web'], cwd: root });
  const settled = checkAuthoring({ cwd: root });
  assert.equal(settled.issues.some((i) => i.type === 'package-version-drift'), false);
});

test('check detects changed source content as a stale wrapper', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  const pkgDir = installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  const sourcePath = join(pkgDir, 'assets/skills/web-test-authoring/SKILL.md');
  writeFileSync(sourcePath, readFileSync(sourcePath, 'utf8') + '\nNew guidance.\n');

  const result = checkAuthoring({ cwd: root });
  assert.ok(result.issues.some((i) => i.type === 'stale-wrapper'));

  updateAuthoring({ lanes: ['web'], cwd: root });
  const settled = checkAuthoring({ cwd: root });
  assert.equal(settled.ok, true);
});

// --- 17. unsupported tool target ---

test('unsupported tool target throws', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  assert.throws(() => installAuthoring({ lanes: ['web'], tools: ['bogus-ide'], cwd: root }), /Unsupported tool target "bogus-ide"/);
});

// --- 18. paths containing spaces ---

test('installation works when the project path contains spaces', () => {
  const root = tmpFixture('mlt authoring test ');
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);

  const { ok } = installAuthoring({ lanes: ['web'], cwd: root });
  assert.equal(ok, true);
  assert.ok(existsSync(join(root, '.claude/skills/web-test-authoring/SKILL.md')));
});

// --- 19. Windows-style path handling in generated links ---

test('generated cross-links always use forward slashes, never backslashes', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  const prompt = readFileSync(join(root, '.github/prompts/web-test-authoring.prompt.md'), 'utf8');
  assert.match(prompt, /\.claude\/skills\/web-test-authoring\/SKILL\.md/);
  assert.equal(prompt.includes('\\'), false);
});

// --- 20. consumer project without an engine checkout beside it ---

test('installation succeeds with no sibling engine checkout and no engine-relative doc access', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  assert.equal(existsSync(join(root, '..', 'multilanetesting')), false);

  const { ok } = installAuthoring({ lanes: ['web'], cwd: root });
  assert.equal(ok, true);
});

// --- 21. prevention of engine-relative paths in portable assets ---

test('portable authoring source files carry no engine-relative path or repo-checkout reference', () => {
  const manifest = loadLaneManifest();
  const forbidden = /(\.\.\/){2,}|\/home\/|docs\/memory\/|C:\\\\/i;
  for (const asset of [...manifest.skills, ...manifest.agents]) {
    const content = readFileSync(join(REAL_AUTHORING_WEB, asset.source), 'utf8');
    assert.equal(forbidden.test(content), false, `${asset.source} contains an engine-relative/repo-local path`);
  }
});

// --- 22. prevention of runtime dependency on authoring packages ---

test('the web runtime package never depends on the web authoring package', () => {
  const webPkg = JSON.parse(readFileSync(join(HERE, '../../web/package.json'), 'utf8'));
  const allDeps = {
    ...webPkg.dependencies,
    ...webPkg.peerDependencies,
    ...webPkg.devDependencies,
  };
  assert.equal('@multilane/authoring-web' in allDeps, false);

  const webIndex = readFileSync(join(HERE, '../../web/index.mjs'), 'utf8');
  assert.equal(webIndex.includes('authoring-web'), false);
});

test('lane-selection drift is detected when multilane.config.json disagrees with provenance', () => {
  const root = tmpFixture();
  writeFixtureProject(root, { lanes: ['web'] });
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  // The project config later drops the web lane while authoring for it is still installed.
  writeFileSync(join(root, 'multilane.config.json'), JSON.stringify({ lanes: ['http'] }, null, 2));

  const result = checkAuthoring({ cwd: root });
  assert.ok(result.issues.some((i) => i.type === 'lane-selection-drift'));
});

// --- 24. install status vocabulary: installed / unchanged / updated ---

test('reinstall reports "unchanged" and a source change reports "updated"', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  const pkgDir = installFixtureAuthoringWeb(root);

  const first = installAuthoring({ lanes: ['web'], cwd: root });
  assert.equal(first.laneReports[0].status, 'installed');

  const again = installAuthoring({ lanes: ['web'], cwd: root });
  assert.equal(again.laneReports[0].status, 'unchanged');

  const sourcePath = join(pkgDir, 'assets/skills/web-test-authoring/SKILL.md');
  writeFileSync(sourcePath, readFileSync(sourcePath, 'utf8') + '\nNew guidance.\n');
  const updated = installAuthoring({ lanes: ['web'], cwd: root, force: true });
  assert.equal(updated.laneReports[0].status, 'updated');
});

// --- 25. malformed provenance is its own condition, not "never installed" ---

test('check reports malformed provenance when the lock file exists but is not valid JSON', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringWeb(root);
  installAuthoring({ lanes: ['web'], cwd: root });

  writeFileSync(join(root, PROVENANCE_PATH), '{ this is not json');

  const result = checkAuthoring({ cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].type, 'malformed-provenance');
});
