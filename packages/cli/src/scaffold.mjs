// @multilane/cli — project scaffolder for `mlt new`.
//
// Generates a *consumer* project that depends on the published engine packages. It never vendors
// framework source — the generated project installs `@multilane/*` from your npm registry.
//
// Every generated artifact is deterministic and free of host/URL/secret literals: target values are
// referenced by env-var name, and the registry/proxy come from the environment via `.npmrc`.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUTHORING_LANE_PACKAGES } from './authoring/registry.mjs';

export const SUPPORTED_LANES = ['web', 'http', 'stomp', 'screen'];
// Read version from this package's manifest so `npm version` keeps scaffolds in sync.
const { version: ENGINE_VERSION } = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
);

// node:test lanes emit a JUnit file (for CI publishing) plus a console reporter. Explicit file
// globs are used because `node --test` does not expand bare directory arguments on all Node 20/22.
const nodeTestScript = (lane) =>
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
  if (selected.length === 0) throw new Error('Select at least one lane: --lanes web,http,stomp,screen');
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
    '@multilane/cli': ENGINE_VERSION,
    '@multilane/core': ENGINE_VERSION,
  };
  const scripts = { verify: 'mlt verify' };

  if (lanes.includes('web')) {
    devDependencies['@multilane/web'] = ENGINE_VERSION;
    devDependencies['@multilane/playwright-config'] = ENGINE_VERSION;
    devDependencies['@playwright/test'] = '^1.61.0';
    scripts['test:web'] = 'playwright test';
  }
  if (lanes.includes('http')) {
    devDependencies['@multilane/http'] = ENGINE_VERSION;
    scripts['test:http'] = nodeTestScript('http');
  }
  if (lanes.includes('stomp')) {
    devDependencies['@multilane/stomp'] = ENGINE_VERSION;
    devDependencies['@stomp/stompjs'] = '^7.0.0';
    devDependencies['ws'] = '^8.18.0';
    scripts['test:stomp'] = nodeTestScript('stomp');
  }
  if (lanes.includes('screen')) {
    devDependencies['@multilane/screen'] = ENGINE_VERSION;
    scripts['test:screen'] = nodeTestScript('screen');
  }
  // Authoring packages are consumer devDependencies (not CLI runtime deps): `mlt authoring
  // install` resolves them from the consumer's node_modules after `npm ci`.
  for (const lane of lanes) {
    if (AUTHORING_LANE_PACKAGES[lane]) devDependencies[AUTHORING_LANE_PACKAGES[lane]] = ENGINE_VERSION;
  }

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

// Passive contract check — asserts shape/status only, never mutates state.
test('health endpoint returns the expected shape', { skip: !host }, async () => {
  const res = await getJson(host + '/health', { approvedHosts });
  assert.equal(res.status, 200);
});
`;

const STOMP_SPEC = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeOnce } from '@multilane/stomp';

const url = process.env.MULTILANE_WS_URL;

// Passive SUBSCRIBE — no active SEND unless MULTILANE_WS_INJECT=1 and the host is approved.
test('receives a frame on the status destination', { skip: !url }, async () => {
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

// --- shared static artifacts ---

const NPMRC = `# .npmrc — scope @multilane to your npm registry. No literal host/token is committed.
# npm expands \${VAR} from the environment before parsing, so every value comes from CI/env.
@multilane:registry=\${NPM_REGISTRY_URL}
\${NPM_REGISTRY_AUTH_HOST}:_authToken=\${NPM_REGISTRY_AUTH_TOKEN}
always-auth=true

# Proxy: npm also honors the standard HTTP_PROXY / HTTPS_PROXY environment variables.
# Uncomment to force them here (values still come from the environment, never committed):
# proxy=\${HTTP_PROXY}
# https-proxy=\${HTTPS_PROXY}
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

The engine ships as versioned \`@multilane/*\` packages from your npm registry — this
project **consumes** them and never vendors framework source.

## Setup

\`\`\`bash
# Registry + proxy come from the environment (see .npmrc). Then:
npm install      # first install — creates package-lock.json; commit it so CI can run npm ci
${lanes.includes('web') ? 'npx playwright install chromium\n' : ''}npm run verify   # runs the deterministic gates (mlt verify)
\`\`\`

If your registry does not serve \`@multilane/*\` yet, install them from \`npm pack\` tarballs
with \`overrides\` (see the engine repo README → Dogfooding).

## Run lanes

${lanes.map((l) => `- \`npm run test:${l}\``).join('\n')}

## Conventions

- Target values (\`MULTILANE_WEB_BASE_URL\`, \`MULTILANE_TARGET_HOST\`, …) come from \`.env\` — no host
  literals in committed files.
- Freeze screen locators under \`locators/<area>/\`; AI is allowed at *authoring* time only.
- \`npm run verify\` must stay green before you push.
`;
}
