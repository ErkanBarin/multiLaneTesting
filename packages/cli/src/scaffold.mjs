// @multilane/cli — project scaffolder for `mlt new`.
//
// Generates a *consumer* project that depends on versioned engine packages. It never vendors
// framework source; consumers install local tarballs or use a configured registry.
//
// Every generated artifact is deterministic and free of host/URL/secret literals: target values are
// referenced by env-var name, and the registry/proxy come from user npm config or CI.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPPORTED_LANES = ['web', 'http', 'stomp', 'screen', 'snmp', 'trap'];
// Read version from this package's manifest so `npm version` keeps scaffolds in sync.
const { version: ENGINE_VERSION } = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
);

// Engine packages are versioned independently. Keep these pins aligned with their manifests;
// `scaffold-versions.test.mjs` fails when they drift from packages/*.
const ENGINE_VERSIONS = {
  '@multilane/cli': ENGINE_VERSION,
  '@multilane/core': '0.1.1',
  '@multilane/web': '0.1.0',
  '@multilane/playwright-config': '0.1.0',
  '@multilane/http': '0.1.1',
  '@multilane/stomp': '0.1.0',
  '@multilane/screen': '0.2.0',
  '@multilane/snmp-runtime': '0.1.0',
  '@multilane/snmp-model': '0.1.0',
};

// The env var each lane's example spec skips on. `screen`, `snmp` and `trap` are absent on purpose:
// they run against a frozen locator or the bundled emulator, so they execute with nothing set.
const LANE_TARGET_ENV = {
  web: 'MULTILANE_WEB_BASE_URL',
  http: 'MULTILANE_TARGET_HOST',
  stomp: 'MULTILANE_WS_URL',
};

export function engineVersion(pkg) {
  const version = ENGINE_VERSIONS[pkg];
  if (!version) throw new Error(`No pinned engine version for ${pkg}`);
  return version;
}

// node:test lanes emit a JUnit file (for CI publishing) plus a console reporter. Explicit file
// globs are used because `node --test` does not expand bare directory arguments on all Node 20/22.
//
// `results/` is created first because the junit reporter does not create its destination directory
// — it throws ENOENT and takes the whole run down before a single test executes. The directory is
// gitignored, so it never arrives with a checkout and every lane failed on its first run in a
// fresh clone. `node -e` rather than `mkdir -p`: these are Node projects, but not all of them are
// on a shell that has `mkdir -p`.
const nodeTestScript = (lane) =>
  `node -e "require('node:fs').mkdirSync('results',{recursive:true})" && ` +
  'node --test --test-reporter=spec --test-reporter-destination=stdout ' +
  `--test-reporter=junit --test-reporter-destination=results/junit-${lane}.xml ` +
  `tests/${lane}/*.test.mjs`;

/**
 * Scaffold a consumer test project.
 * @param {{ name: string, lanes: string[], cwd?: string, force?: boolean }} options
 * @returns {{ root: string, files: string[] }}
 */
export function scaffoldProject({ name, lanes, cwd = process.cwd(), force = false }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name ?? '')) {
    throw new Error(`Invalid project name "${name}". Use lowercase letters, digits, and hyphens.`);
  }
  const selected = [...new Set(lanes ?? [])];
  if (selected.length === 0) throw new Error(`Select at least one lane: --lanes ${SUPPORTED_LANES.join(',')}`);
  for (const lane of selected) {
    if (!SUPPORTED_LANES.includes(lane)) {
      throw new Error(`Unknown lane "${lane}". Supported: ${SUPPORTED_LANES.join(', ')}`);
    }
  }

  const root = join(cwd, name);
  if (existsSync(root) && !force) {
    throw new Error(`Refusing to overwrite existing directory: ${root} (pass force to override).`);
  }

  const files = new Map();
  files.set('package.json', renderPackageJson(name, selected));
  files.set('.npmrc', NPMRC);
  files.set('multilane.config.json', renderProjectConfig(selected));
  files.set('.env.example', renderEnvExample(selected));
  files.set('.gitignore', GITIGNORE);
  files.set('Jenkinsfile', renderJenkinsfile(selected));
  files.set('README.md', renderReadme(name, selected));
  files.set('locators/.gitkeep', '');

  for (const lane of selected) {
    for (const [path, content] of laneFiles(lane)) files.set(path, content);
  }

  const written = [];
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(rel);
  }
  return { root, files: written.sort() };
}

// --- root artifacts ---

function renderPackageJson(name, lanes) {
  const devDependencies = {
    '@multilane/cli': engineVersion('@multilane/cli'),
    '@multilane/core': engineVersion('@multilane/core'),
  };
  const scripts = { verify: 'mlt verify' };

  if (lanes.includes('web')) {
    devDependencies['@multilane/web'] = engineVersion('@multilane/web');
    devDependencies['@multilane/playwright-config'] = engineVersion('@multilane/playwright-config');
    devDependencies['@playwright/test'] = '^1.61.0';
    scripts['test:web'] = 'playwright test';
  }
  if (lanes.includes('http')) {
    devDependencies['@multilane/http'] = engineVersion('@multilane/http');
    scripts['test:http'] = nodeTestScript('http');
  }
  if (lanes.includes('stomp')) {
    devDependencies['@multilane/stomp'] = engineVersion('@multilane/stomp');
    devDependencies['@stomp/stompjs'] = '^7.0.0';
    devDependencies['ws'] = '^8.18.0';
    scripts['test:stomp'] = nodeTestScript('stomp');
  }
  if (lanes.includes('screen')) {
    devDependencies['@multilane/screen'] = engineVersion('@multilane/screen');
    scripts['test:screen'] = nodeTestScript('screen');
  }
  // snmp and trap are the two halves of one runtime — the emulated agent and the trap listener —
  // so both pull the same package. net-snmp is its peer transport and must be installed alongside.
  if (lanes.includes('snmp') || lanes.includes('trap')) {
    devDependencies['@multilane/snmp-runtime'] = engineVersion('@multilane/snmp-runtime');
    devDependencies['@multilane/snmp-model'] = engineVersion('@multilane/snmp-model');
    devDependencies['net-snmp'] = '^3.26.3';
  }
  if (lanes.includes('snmp')) scripts['test:snmp'] = nodeTestScript('snmp');
  if (lanes.includes('trap')) scripts['test:trap'] = nodeTestScript('trap');

  return `${JSON.stringify(
    {
      name: `${name}-system-tests`,
      private: true,
      version: '0.0.0',
      type: 'module',
      description: `System tests for ${name} built on the multilanetesting engine.`,
      scripts,
      devDependencies,
      engines: { node: '>=20' },
    },
    null,
    2,
  )}\n`;
}

function renderProjectConfig(lanes) {
  return `${JSON.stringify(
    {
      $comment: 'Gate + lane settings read by @multilane/core. Add Robot @tags here as specs gain them.',
      lanes,
      specDir: 'tests',
      robotTags: [],
    },
    null,
    2,
  )}\n`;
}

function renderEnvExample(lanes) {
  const blocks = ['# Copy to .env (gitignored) and fill real values. Committed files reference names only.', ''];
  if (lanes.includes('web')) blocks.push('# Web / DOM lane', 'MULTILANE_WEB_BASE_URL=', '');
  if (lanes.includes('http'))
    blocks.push('# API contract lane (passive)', 'MULTILANE_API_CONTRACT=0', 'MULTILANE_TARGET_HOST=', 'MULTILANE_APPROVED_HOSTS=', '');
  if (lanes.includes('stomp'))
    blocks.push('# WS contract lane', 'MULTILANE_WS_CONTRACT=0', 'MULTILANE_WS_INJECT=0', 'MULTILANE_WS_URL=', '');
  if (lanes.includes('screen'))
    blocks.push(
      '# Screen-driver lane (VNC/RDP / C++ HMI / COTS)',
      'SCREEN_TARGET_HOST=',
      'SCREEN_RPS_PARTITION=TEST_A   # test partition only — never PROD',
      'SCREEN_DISPLAY=:99',
      '# A target reached over VNC/RDP (openViewer): vnc or rdp, and its desktop size, e.g. 1920x1080.',
      '# Credentials are read from here, never passed on a command line.',
      'SCREEN_TARGET_PROTOCOL=',
      'SCREEN_GEOMETRY=',
      'SCREEN_TARGET_USER=',
      'SCREEN_TARGET_PASSWORD=',
      '',
    );
  if (lanes.includes('snmp'))
    blocks.push(
      '# SNMP contract lane (passive GET/WALK against a live agent)',
      'MULTILANE_SNMP_CONTRACT=0   # 1 to run against the host below instead of the emulator',
      'MULTILANE_SNMP_HOST=',
      'MULTILANE_SNMP_PORT=161',
      '# Per-run credential. Never commit a real community string.',
      'MULTILANE_SNMP_COMMUNITY=',
      '',
    );
  if (lanes.includes('trap'))
    blocks.push(
      '# Trap lane (receive-only). 162 is privileged — use a high port or a redirect.',
      'MULTILANE_TRAP_PORT=16162',
      'MULTILANE_TRAP_BIND=127.0.0.1   # widen deliberately, never implicitly',
      '',
    );
  return `${blocks.join('\n')}\n`;
}

// --- per-lane artifacts ---

function laneFiles(lane) {
  switch (lane) {
    case 'web':
      return [
        ['playwright.config.ts', WEB_PW_CONFIG],
        ['tests/web/example.web.spec.ts', WEB_SPEC],
      ];
    case 'http':
      return [['tests/http/example.http.test.mjs', HTTP_SPEC]];
    case 'stomp':
      return [['tests/stomp/example.stomp.test.mjs', STOMP_SPEC]];
    case 'screen':
      return [
        ['tests/screen/example.screen.test.mjs', SCREEN_SPEC],
        ['locators/example/appTitle.json', SCREEN_LOCATOR],
      ];
    case 'snmp':
      return [
        ['tests/snmp/example.snmp.test.mjs', SNMP_SPEC],
        ['models/example.agent.json', EXAMPLE_AGENT_MODEL],
      ];
    case 'trap':
      return [
        ['tests/trap/example.trap.test.mjs', TRAP_SPEC],
        ['models/example.agent.json', EXAMPLE_AGENT_MODEL],
      ];
    default:
      return [];
  }
}

const WEB_PW_CONFIG = `import { definePlaywrightConfig } from '@multilane/playwright-config';

// Extend the shared preset. baseURL comes from MULTILANE_WEB_BASE_URL — no host literal here.
export default definePlaywrightConfig({ testDir: './tests/web' });
`;

const WEB_SPEC = `import { test, expect } from '@playwright/test';
import { selectorFactory } from '@multilane/web';

// Example web/DOM spec. Replace the selector map with locators frozen for your target.
test('user sees the application shell', async ({ page }) => {
  // Without a baseURL, \`goto('/')\` throws "Invalid URL" — a red test that says nothing about the
  // real cause. Skip with the variable name instead, the way the http and stomp lanes do.
  test.skip(!process.env.MULTILANE_WEB_BASE_URL, 'MULTILANE_WEB_BASE_URL is not set — nothing was tested');

  const ui = selectorFactory(page, { appRoot: 'body' });

  await test.step('user opens the app', async () => {
    await page.goto('/');
  });

  await test.step('user sees the shell render', async () => {
    await expect(ui.appRoot()).toBeVisible();
  });
});
`;

const HTTP_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getJson } from '@multilane/http';

const host = process.env.MULTILANE_TARGET_HOST;
const approvedHosts = (process.env.MULTILANE_APPROVED_HOSTS ?? '').split(',').filter(Boolean);

// A skip still exits 0, so the reason is spelled out: a green run with nothing executed reads
// exactly like a passing suite otherwise.
const skip = host ? false : 'MULTILANE_TARGET_HOST is not set — nothing was tested';

// Passive contract check — asserts shape/status only, never mutates state.
test('health endpoint returns the expected shape', { skip }, async () => {
  const res = await getJson(host + '/health', { approvedHosts });
  assert.equal(res.status, 200);
});
`;

const STOMP_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeOnce } from '@multilane/stomp';

const url = process.env.MULTILANE_WS_URL;

// A skip still exits 0, so the reason is spelled out: a green run with nothing executed reads
// exactly like a passing suite otherwise.
const skip = url ? false : 'MULTILANE_WS_URL is not set — nothing was tested';

// Passive SUBSCRIBE — no active SEND unless MULTILANE_WS_INJECT=1 and the host is approved.
test('receives a frame on the status destination', { skip }, async () => {
  const msg = await subscribeOnce(url, '/topic/status', { timeoutMs: 5000 });
  assert.ok(msg);
});
`;

const SCREEN_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';

// Screen specs replay FROZEN locators — no AI runs here. Freeze locators under locators/<area>/.
test('the frozen locator is valid and replayable', () => {
  const locator = loadFrozenLocator('example', 'appTitle');
  assert.equal(assertFrozen(locator).ok, true);
});
`;

const SCREEN_LOCATOR = `${JSON.stringify(
  {
    area: 'example',
    key: 'appTitle',
    tier: 1,
    resolver: 'object:app.titleLabel',
    stamp: { dpi: 96, resolution: '1920x1080', theme: 'default' },
    requirement_ref: 'REQ_EXAMPLE_0001',
    last_verified: '2026-07-07',
  },
  null,
  2,
)}\n`;

// A minimal valid EmulatedAgentModel. The OID arc is a placeholder — replace it with your own
// enterprise arc (and this whole file with a model built from your real MIB) before asserting
// anything about a product. Both the snmp and trap example specs run against it, so a freshly
// scaffolded project is green on `npm test` with no live agent anywhere.
const EXAMPLE_AGENT_MODEL = `${JSON.stringify(
  {
    subsystem: 'example',
    confFile: '',
    smiFile: '',
    hostTypes: [{ name: 'example', version: 'v2c' }],
    scalars: [
      {
        name: 'exampleStatus',
        oid: '1.3.6.1.4.1.99999.1',
        readOnly: true,
        enumValues: { up: 1, down: 2 },
        initial: { type: 'Integer', value: 1, enumLabel: 'up' },
        usedBy: ['exampleStatus'],
      },
    ],
    tables: [],
    notifications: [
      { name: 'exampleStatusChange', oid: '1.3.6.1.4.1.99999.3.1', objects: ['exampleStatus'] },
    ],
    gaps: [],
  },
  null,
  2,
)}\n`;

// Both SNMP specs bind ephemeral loopback ports: a fixed port makes two projects on one CI agent
// collide, and the collision looks like a flaky test rather than a port clash.
const SNMP_FREE_PORT = `import { createSocket } from 'node:dgram';

function freeUdpPort() {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    socket.on('error', reject);
    socket.bind(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolve(port));
    });
  });
}
`;

const SNMP_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as snmp from 'net-snmp';
import { startEmulatedAgent } from '@multilane/snmp-runtime';
import { validateModel } from '@multilane/snmp-model';

${SNMP_FREE_PORT}
const model = JSON.parse(readFileSync(new URL('../../models/example.agent.json', import.meta.url), 'utf8'));

test('the model is structurally valid', () => {
  assert.deepEqual(validateModel(model), []);
});

// Runs against the emulator, so it needs no live agent. Point it at a real one by reading
// MULTILANE_SNMP_HOST/PORT when MULTILANE_SNMP_CONTRACT=1 — keep the emulated path as the default.
test('a scalar the model declares is readable over SNMP', async () => {
  const port = await freeUdpPort();
  // Per-run community: a committed credential is a credential you have to rotate.
  const community = \`example-\${Math.random().toString(36).slice(2)}\`;
  const agent = startEmulatedAgent({ model, port, community });
  const session = snmp.createSession('127.0.0.1', community, { port, version: snmp.Version2c, timeout: 1000, retries: 0 });
  try {
    const varbinds = await new Promise((resolve, reject) => {
      session.get(['1.3.6.1.4.1.99999.1.0'], (err, vbs) => (err ? reject(err) : resolve(vbs)));
    });
    assert.equal(varbinds[0].value.toString(), '1'); // exampleStatus = up
  } finally {
    session.close();
    agent.close();
  }
});
`;

const TRAP_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startEmulatedAgent, startTrapListener } from '@multilane/snmp-runtime';

${SNMP_FREE_PORT}
const model = JSON.parse(readFileSync(new URL('../../models/example.agent.json', import.meta.url), 'utf8'));

// The trap lane is RECEIVE-ONLY. The listener never sends and binds loopback by default; the
// emulated agent here is the sender, which is what makes this runnable with no live dispatcher.
test('an emitted notification arrives and decodes', async () => {
  const agentPort = await freeUdpPort();
  const trapPort = await freeUdpPort();
  const community = \`example-\${Math.random().toString(36).slice(2)}\`;
  const listener = startTrapListener({ port: trapPort });
  const agent = startEmulatedAgent({ model, port: agentPort, community, trapTarget: { port: trapPort, community } });

  try {
    agent.set('exampleStatus', 'down');
    await agent.emit('exampleStatusChange');

    const trap = await listener.waitForTrap(
      (n) => n.varbinds.some((vb) => vb.oid === '1.3.6.1.4.1.99999.1.0'),
      5000,
    );
    const status = trap.varbinds.find((vb) => vb.oid === '1.3.6.1.4.1.99999.1.0');
    assert.equal(String(status.value), '2'); // exampleStatus = down
  } finally {
    agent.close();
    listener.close();
  }
});
`;

// --- shared static artifacts ---

const NPMRC = `# No registry or credentials are configured by this scaffold.
# Use scripts/install-tarballs.mjs from the engine clone, or set @multilane:registry
# in user npm configuration if you publish the packages to a registry.
`;

const GITIGNORE = `node_modules/
.env
.env.*
!.env.example
results/
artifacts/
playwright-report/
test-results/
# Commit package-lock.json so CI can run \`npm ci\` reproducibly.
`;

function renderJenkinsfile(lanes) {
  return `// Thin per-system pipeline — all logic lives in the multilanetesting Jenkins Shared Library.
// Configure the library "multilane-jenkins" in Jenkins > Global Pipeline Libraries.
@Library('multilane-jenkins') _

runLaneTests(
  lanes: '${lanes.join(',')}',
  targetUrl: params.TARGET_URL ?: env.MULTILANE_WEB_BASE_URL,
  nodeVersion: params.NODE_VERSION ?: '22.11.0',
  agentLabel: params.AGENT_LABEL ?: '<JENKINS_AGENT_LABEL>'
)
`;
}

function renderReadme(name, lanes) {
  return `# ${name}-system-tests

System tests for **${name}**, built on the [multilanetesting](../) engine. Lanes: ${lanes
    .map((l) => `\`${l}\``)
    .join(', ')}.

The engine ships as versioned \`@multilane/*\` packages. This project **consumes** them and
never vendors framework source.

## Setup

\`\`\`bash
# From the engine clone, pack and install local tarballs (see its README):
node <engine-repo>/scripts/install-tarballs.mjs .
${lanes.includes('web') ? 'npx playwright install chromium\n' : ''}npm run verify   # runs the deterministic gates (mlt verify)
\`\`\`

## Run lanes

${lanes.map((l) => `- \`npm run test:${l}\``).join('\n')}

\`npm run verify\` checks static gates only; run each selected lane with \`npm run test:<lane>\`.
A skipped lane example still exits \`0\` and does not prove live-target behavior.
Each example spec says which it is:

${lanes
  .map((l) =>
    LANE_TARGET_ENV[l]
      ? `- \`${l}\` — skips until \`${LANE_TARGET_ENV[l]}\` is set, and says so in the skip reason.`
      : `- \`${l}\` — runs against the bundled emulator or a frozen locator; needs no target.`,
  )
  .join('\n')}

## Conventions

- Target values (\`MULTILANE_WEB_BASE_URL\`, \`MULTILANE_TARGET_HOST\`, …) come from \`.env\` — no host
  literals in committed files.
- Freeze screen locators under \`locators/<area>/\`; AI is allowed at *authoring* time only.
- \`npm run verify\` must stay green before you push.
`;
}
