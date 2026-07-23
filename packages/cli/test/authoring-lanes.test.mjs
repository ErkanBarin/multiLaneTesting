// @multilane/cli — HTTP/STOMP authoring lane contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installAuthoring, PROVENANCE_PATH } from '../index.mjs';
import { loadLaneManifest as loadHttpManifest } from '@multilane/authoring-http';
import { loadLaneManifest as loadStompManifest } from '@multilane/authoring-stomp';
import { tmpFixture, writeFixtureProject, installFixtureAuthoringPackage } from './support/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANES = [
  {
    name: 'HTTP',
    lane: 'http',
    runtimePackage: '@multilane/http',
    authoringPackage: '@multilane/authoring-http',
    loadManifest: loadHttpManifest,
    skill: 'http-test-authoring',
    agent: 'api-explorer',
    missingPrerequisite: /MULTILANE_TARGET_HOST/,
    enabledEnv: {
      MULTILANE_TARGET_HOST: 'example-test-host',
      MULTILANE_APPROVED_HOSTS: 'example-test-host',
    },
    assertPrerequisites(agent) {
      assert.ok(agent.requires.env.includes('MULTILANE_TARGET_HOST'));
      assert.equal(agent.requires.mcpServers ?? undefined, undefined);
    },
    installedPaths: [
      '.claude/skills/http-test-authoring/SKILL.md',
      '.github/prompts/http-test-authoring.prompt.md',
    ],
    enabledPaths: [
      '.claude/agents/api-explorer.md',
      '.github/agents/api-explorer-worker.agent.md',
    ],
  },
  {
    name: 'STOMP',
    lane: 'stomp',
    runtimePackage: '@multilane/stomp',
    authoringPackage: '@multilane/authoring-stomp',
    loadManifest: loadStompManifest,
    skill: 'stomp-test-authoring',
    agent: 'stomp-explorer',
    missingPrerequisite: /MULTILANE_WS_URL/,
    enabledEnv: { MULTILANE_WS_URL: 'ws://example-test-broker' },
    assertPrerequisites(agent) {
      assert.deepEqual(agent.requires.env, ['MULTILANE_WS_URL']);
    },
    installedPaths: ['.claude/skills/stomp-test-authoring/SKILL.md'],
    enabledPaths: ['.claude/agents/stomp-explorer.md'],
  },
];

function installLaneFixture(laneCase) {
  const root = tmpFixture();
  writeFixtureProject(root);
  installFixtureAuthoringPackage(root, laneCase.lane, join(HERE, `../../authoring-${laneCase.lane}`));
  return root;
}

for (const laneCase of LANES) {
  test(`${laneCase.name} lane manifest has the required deterministic shape`, () => {
    const manifest = laneCase.loadManifest();
    assert.equal(manifest.lane, laneCase.lane);
    assert.equal(manifest.runtimePackage, laneCase.runtimePackage);
    assert.equal(manifest.authoringPackage, laneCase.authoringPackage);
    assert.ok(Array.isArray(manifest.skills) && manifest.skills.length >= 1);
    assert.ok(Array.isArray(manifest.agents) && manifest.agents.length >= 1);
    laneCase.assertPrerequisites(manifest.agents[0]);
  });

  test(`${laneCase.name} lane installs its skill and reports its optional agent without prerequisites`, () => {
    const root = installLaneFixture(laneCase);
    const { ok, laneReports } = installAuthoring({ lanes: [laneCase.lane], cwd: root, env: {} });
    const [report] = laneReports;

    assert.equal(ok, true);
    assert.equal(report.status, 'installed');
    assert.deepEqual(report.enabled, [laneCase.skill]);
    assert.equal(report.notEnabled.length, 1);
    assert.equal(report.notEnabled[0].id, laneCase.agent);
    assert.match(report.notEnabled[0].reason, laneCase.missingPrerequisite);
    for (const path of laneCase.installedPaths) assert.ok(existsSync(join(root, path)), path);
    assert.ok(!existsSync(join(root, laneCase.enabledPaths[0])));
    assert.ok(existsSync(join(root, PROVENANCE_PATH)));
  });

  test(`${laneCase.name} optional agent enables once its prerequisites are set`, () => {
    const root = installLaneFixture(laneCase);
    const { laneReports } = installAuthoring({
      lanes: [laneCase.lane],
      cwd: root,
      env: laneCase.enabledEnv,
    });

    assert.deepEqual(laneReports[0].enabled.sort(), [laneCase.agent, laneCase.skill].sort());
    assert.equal(laneReports[0].notEnabled.length, 0);
    for (const path of laneCase.enabledPaths) assert.ok(existsSync(join(root, path)), path);
  });

  test(`${laneCase.name} portable sources carry no engine-relative path or repo-checkout reference`, () => {
    const packageRoot = join(HERE, `../../authoring-${laneCase.lane}`);
    const forbidden = /(\.\.\/){2,}|\/home\/|docs\/memory\/|C:\\\\/i;
    const manifest = laneCase.loadManifest();
    for (const asset of [...manifest.skills, ...manifest.agents]) {
      const content = readFileSync(join(packageRoot, asset.source), 'utf8');
      assert.equal(forbidden.test(content), false, `${laneCase.name}: ${asset.source} contains a repo-local path`);
    }
  });

  test(`${laneCase.name} runtime package never depends on its authoring package`, () => {
    const packageRoot = join(HERE, `../../${laneCase.lane}`);
    const runtimePackage = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    const allDependencies = {
      ...runtimePackage.dependencies,
      ...runtimePackage.peerDependencies,
      ...runtimePackage.devDependencies,
    };
    assert.equal(laneCase.authoringPackage in allDependencies, false);
    assert.equal(readFileSync(join(packageRoot, 'index.mjs'), 'utf8').includes(`authoring-${laneCase.lane}`), false);
  });
}

test('web, HTTP, and STOMP authoring lanes install together', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  for (const lane of ['web', 'http', 'stomp']) {
    installFixtureAuthoringPackage(root, lane, join(HERE, `../../authoring-${lane}`));
  }

  const { ok, laneReports } = installAuthoring({ lanes: ['web', 'http', 'stomp'], cwd: root, env: {} });
  const byLane = Object.fromEntries(laneReports.map((report) => [report.lane, report]));
  assert.equal(ok, true);
  for (const lane of ['web', ...LANES.map(({ lane }) => lane)]) assert.equal(byLane[lane].status, 'installed');
  assert.deepEqual(byLane.web.enabled, ['web-test-authoring']);
  for (const laneCase of LANES) assert.deepEqual(byLane[laneCase.lane].enabled, [laneCase.skill]);
});