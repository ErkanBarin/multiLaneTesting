// @erkanbarin/cli — HTTP/STOMP/screen/SNMP/trap authoring lane contracts.
//
// Table-driven: adding a lane is one `LANES` entry, not a new test file.
//
// Two fields are listed explicitly rather than derived from the lane name:
//   - `runtimeDirs`, because a lane need not own a same-named runtime package. `snmp` and `trap`
//     are the two halves of one runtime and share snmp-runtime + snmp-model; there is no
//     `packages/snmp` or `packages/trap` for a name-derived path to find.
//   - `skills`/`agents` as arrays, because a lane may ship more than one of each (screen ships
//     four skills and three agents).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeConfigure, installAuthoring, PROVENANCE_PATH } from '../index.mjs';
import { loadLaneManifest as loadHttpManifest } from '@erkanbarin/authoring-http';
import { loadLaneManifest as loadStompManifest } from '@erkanbarin/authoring-stomp';
import { loadLaneManifest as loadScreenManifest } from '@erkanbarin/authoring-screen';
import { loadLaneManifest as loadSnmpManifest } from '@erkanbarin/authoring-snmp';
import { loadLaneManifest as loadTrapManifest } from '@erkanbarin/authoring-trap';
import {
  tmpFixture,
  writeFixtureProject,
  writeMcpConfig,
  installFixtureAuthoringPackage,
} from './support/fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANES = [
  {
    name: 'HTTP',
    lane: 'http',
    runtimePackage: '@erkanbarin/http',
    runtimeDirs: ['http'],
    authoringPackage: '@erkanbarin/authoring-http',
    loadManifest: loadHttpManifest,
    skills: ['http-test-authoring'],
    agents: ['api-explorer'],
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
    runtimePackage: '@erkanbarin/stomp',
    runtimeDirs: ['stomp'],
    authoringPackage: '@erkanbarin/authoring-stomp',
    loadManifest: loadStompManifest,
    skills: ['stomp-test-authoring'],
    agents: ['stomp-explorer'],
    missingPrerequisite: /MULTILANE_WS_URL/,
    enabledEnv: { MULTILANE_WS_URL: 'ws://example-test-broker' },
    assertPrerequisites(agent) {
      assert.deepEqual(agent.requires.env, ['MULTILANE_WS_URL']);
    },
    installedPaths: ['.claude/skills/stomp-test-authoring/SKILL.md'],
    enabledPaths: ['.claude/agents/stomp-explorer.md'],
  },
  {
    name: 'screen',
    lane: 'screen',
    runtimePackage: '@erkanbarin/screen',
    runtimeDirs: ['screen'],
    authoringPackage: '@erkanbarin/authoring-screen',
    loadManifest: loadScreenManifest,
    skills: [
      'screen-operator',
      'screen-exploration',
      'screen-test-implementation',
      'screen-flake-hardening',
    ],
    agents: ['screen-explorer', 'screen-test-designer', 'screen-flake-debugger'],
    // The screen agents gate on an MCP server, not an env var (same shape as web/ui-explorer).
    missingPrerequisite: /screen-driver MCP configuration was not detected/i,
    enableFixture(root) {
      // The lane's own declared entry, so the test exercises what `configure` tells a consumer.
      writeMcpConfig(root, loadScreenManifest().mcpServerConfigs);
    },
    assertPrerequisites(agent) {
      assert.deepEqual(agent.requires.mcpServers, ['screen-driver']);
      assert.equal(agent.requires.env ?? undefined, undefined);
    },
    installedPaths: [
      '.claude/skills/screen-operator/SKILL.md',
      '.claude/skills/screen-exploration/SKILL.md',
      '.claude/skills/screen-test-implementation/SKILL.md',
      '.claude/skills/screen-flake-hardening/SKILL.md',
      '.github/prompts/screen-operator.prompt.md',
    ],
    enabledPaths: [
      '.claude/agents/screen-explorer.md',
      '.claude/agents/screen-test-designer.md',
      '.claude/agents/screen-flake-debugger.md',
      '.github/agents/screen-explorer-worker.agent.md',
    ],
  },
  {
    name: 'SNMP',
    lane: 'snmp',
    runtimePackage: '@erkanbarin/snmp-runtime',
    runtimeDirs: ['snmp-runtime', 'snmp-model'],
    authoringPackage: '@erkanbarin/authoring-snmp',
    loadManifest: loadSnmpManifest,
    skills: ['snmp-test-authoring'],
    agents: ['snmp-explorer'],
    missingPrerequisite: /MULTILANE_SNMP_HOST/,
    enabledEnv: {
      MULTILANE_SNMP_HOST: 'example-test-agent',
      MULTILANE_APPROVED_HOSTS: 'example-test-agent',
    },
    assertPrerequisites(agent) {
      assert.deepEqual(agent.requires.env, ['MULTILANE_SNMP_HOST', 'MULTILANE_APPROVED_HOSTS']);
      assert.equal(agent.requires.mcpServers ?? undefined, undefined);
    },
    installedPaths: [
      '.claude/skills/snmp-test-authoring/SKILL.md',
      '.github/prompts/snmp-test-authoring.prompt.md',
    ],
    enabledPaths: [
      '.claude/agents/snmp-explorer.md',
      '.github/agents/snmp-explorer-worker.agent.md',
    ],
  },
  {
    name: 'trap',
    lane: 'trap',
    // The trap lane is the receive-only half of the same runtime the snmp lane drives.
    runtimePackage: '@erkanbarin/snmp-runtime',
    runtimeDirs: ['snmp-runtime', 'snmp-model'],
    authoringPackage: '@erkanbarin/authoring-trap',
    loadManifest: loadTrapManifest,
    skills: ['trap-test-authoring'],
    agents: ['trap-inspector'],
    missingPrerequisite: /MULTILANE_TRAP_PORT/,
    enabledEnv: { MULTILANE_TRAP_PORT: '16162' },
    assertPrerequisites(agent) {
      assert.deepEqual(agent.requires.env, ['MULTILANE_TRAP_PORT']);
    },
    installedPaths: ['.claude/skills/trap-test-authoring/SKILL.md'],
    enabledPaths: ['.claude/agents/trap-inspector.md'],
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
    const packageVersion = JSON.parse(readFileSync(join(HERE, `../../authoring-${laneCase.lane}/package.json`), 'utf8')).version;
    const cli = JSON.parse(readFileSync(join(HERE, '../package.json'), 'utf8'));
    assert.equal(cli.devDependencies[laneCase.authoringPackage], packageVersion);
    assert.equal(manifest.version, packageVersion);
    assert.equal(manifest.lane, laneCase.lane);
    assert.equal(manifest.runtimePackage, laneCase.runtimePackage);
    assert.equal(manifest.authoringPackage, laneCase.authoringPackage);
    assert.ok(manifest.compatibility.minRuntimeVersion);
    assert.ok(Array.isArray(manifest.requiredTools));
    assert.ok(Array.isArray(manifest.optionalMcpServers));
    assert.ok(Array.isArray(manifest.envPrerequisites));
    assert.deepEqual(manifest.skills.map((s) => s.id), laneCase.skills);
    assert.deepEqual(manifest.agents.map((a) => a.id), laneCase.agents);
    for (const agent of manifest.agents) assert.deepEqual(agent.tools, ['execute'], agent.id);
    laneCase.assertPrerequisites(manifest.agents[0]);
  });

  test(`${laneCase.name} lane installs its skills and reports its optional agents without prerequisites`, () => {
    const root = installLaneFixture(laneCase);
    const { ok, laneReports } = installAuthoring({ lanes: [laneCase.lane], cwd: root, env: {} });
    const [report] = laneReports;

    assert.equal(ok, true);
    assert.equal(report.status, 'installed');
    assert.deepEqual([...report.enabled].sort(), [...laneCase.skills].sort());
    assert.deepEqual(report.notEnabled.map((a) => a.id).sort(), [...laneCase.agents].sort());
    for (const notEnabled of report.notEnabled) {
      assert.match(notEnabled.reason, laneCase.missingPrerequisite);
    }
    for (const path of laneCase.installedPaths) assert.ok(existsSync(join(root, path)), path);
    for (const path of laneCase.enabledPaths) assert.ok(!existsSync(join(root, path)), path);
    assert.ok(existsSync(join(root, PROVENANCE_PATH)));
  });

  test(`${laneCase.name} optional agents enable once their prerequisites are met`, () => {
    const root = installLaneFixture(laneCase);
    laneCase.enableFixture?.(root);
    const { laneReports } = installAuthoring({
      lanes: [laneCase.lane],
      cwd: root,
      env: laneCase.enabledEnv ?? {},
    });

    assert.deepEqual(
      [...laneReports[0].enabled].sort(),
      [...laneCase.skills, ...laneCase.agents].sort(),
    );
    assert.equal(laneReports[0].notEnabled.length, 0);
    for (const path of laneCase.enabledPaths) assert.ok(existsSync(join(root, path)), path);
    for (const agent of laneCase.loadManifest().agents) {
      const worker = readFileSync(join(root, agent.targets['copilot-agent'].path), 'utf8');
      if (agent.tools?.includes('execute')) {
        assert.match(worker, /"execute"/, agent.id);
      }
      if (laneCase.lane === 'screen') assert.match(worker, /"screen-driver\/\*"/, agent.id);
    }
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
    for (const dir of laneCase.runtimeDirs) {
      const packageRoot = join(HERE, `../../${dir}`);
      const runtimePackage = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
      const allDependencies = {
        ...runtimePackage.dependencies,
        ...runtimePackage.peerDependencies,
        ...runtimePackage.devDependencies,
      };
      assert.equal(laneCase.authoringPackage in allDependencies, false, dir);
      const index = readFileSync(join(packageRoot, 'index.mjs'), 'utf8');
      assert.equal(index.includes(`authoring-${laneCase.lane}`), false, dir);
    }
  });
}

test('portable agent skills use array frontmatter accepted by Copilot CLI', () => {
  for (const lane of ['web', ...LANES.map(({ lane }) => lane)]) {
    const packageRoot = join(HERE, `../../authoring-${lane}`);
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'lane.manifest.json'), 'utf8'));
    for (const agent of manifest.agents) {
      const content = readFileSync(join(packageRoot, agent.source), 'utf8');
      assert.match(content, /^skills: \[[^\]\n]+\]$/m, agent.source);
    }
  }
});

// The screen lane replays into a test partition and never into the operational one. That rule is
// safety-critical and lives in the packaged content, so it is asserted here rather than left to a
// reviewer noticing its removal.
test('every screen asset states the test-partition rule and never endorses PROD', () => {
  const manifest = loadScreenManifest();
  const packageRoot = join(HERE, '../../authoring-screen');
  for (const asset of [...manifest.skills, ...manifest.agents]) {
    const content = readFileSync(join(packageRoot, asset.source), 'utf8');
    assert.match(content, /TEST_A/, asset.source);
    assert.match(content, /never\s+`?PROD`?/i, asset.source);
  }
});

test('screen configure prints the exact MCP entry, naming a bin the package ships', () => {
  const root = installLaneFixture(LANES.find(({ lane }) => lane === 'screen'));
  const instructions = describeConfigure('screen-explorer', { cwd: root });
  assert.match(instructions, /"multilane-screen-mcp"/);
  assert.match(instructions, /"SCREEN_DRIVER_MODE": "authoring"/);
  // An entry pointing at a bin the package does not ship configures an agent that cannot start.
  const pkg = JSON.parse(readFileSync(join(HERE, '../../authoring-screen/package.json'), 'utf8'));
  const { args } = loadScreenManifest().mcpServerConfigs['screen-driver'];
  const bin = pkg.bin[args.at(-1)];
  assert.ok(bin && pkg.files.includes(bin.replace(/^\.\//, '')), `${args.at(-1)} is not a shipped bin`);
});

test('every authoring lane installs together in one call', () => {
  const root = tmpFixture();
  writeFixtureProject(root);
  const lanes = ['web', ...LANES.map(({ lane }) => lane)];
  for (const lane of lanes) {
    installFixtureAuthoringPackage(root, lane, join(HERE, `../../authoring-${lane}`));
  }

  const { ok, laneReports } = installAuthoring({ lanes, cwd: root, env: {} });
  const byLane = Object.fromEntries(laneReports.map((report) => [report.lane, report]));
  assert.equal(ok, true);
  for (const lane of lanes) assert.equal(byLane[lane].status, 'installed', lane);
  assert.deepEqual(byLane.web.enabled, ['web-test-authoring']);
  for (const laneCase of LANES) {
    assert.deepEqual([...byLane[laneCase.lane].enabled].sort(), [...laneCase.skills].sort());
  }
});
