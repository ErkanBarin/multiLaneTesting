// @multilane/core — configuration.
//
// Two kinds of config:
//   1. Runtime config  — target-facing values resolved from the environment (hosts, partitions,
//      lane flags). Every value has a documented default; NO host/URL literal lives in code.
//   2. Project config  — optional gate/lane settings read from `multilane.config.json` at the
//      project root. Used by the gates and `mlt verify` so a consumer can tune scan roots and the
//      Robot @tag allowlist without editing engine code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Project-config defaults (also consumed by the gates) ---
export const DEFAULT_RUNTIME_DIRS = ['drivers', 'tests', 'apps'];
export const DEFAULT_AUTHORING_DIRS = ['authoring', 'drivers/mcp'];
export const DEFAULT_SPEC_DIR = 'tests';
export const DEFAULT_CONTRACT_DOC = 'docs/ci/robot-orchestration.md';

/**
 * Resolve target-facing runtime config from the environment. Never returns a hardcoded host — a
 * value is either supplied by the environment or falls back to a documented, non-host default.
 */
export function loadConfig(env = process.env) {
  return {
    web: {
      baseUrl: env.MULTILANE_WEB_BASE_URL ?? '',
    },
    http: {
      enabled: env.MULTILANE_API_CONTRACT === '1',
      host: env.MULTILANE_TARGET_HOST ?? '',
      approvedHosts: splitList(env.MULTILANE_APPROVED_HOSTS),
    },
    ws: {
      enabled: env.MULTILANE_WS_CONTRACT === '1',
      inject: env.MULTILANE_WS_INJECT === '1',
      url: env.MULTILANE_WS_URL ?? '',
      approvedHosts: splitList(env.MULTILANE_APPROVED_HOSTS),
    },
    screen: {
      host: env.SCREEN_TARGET_HOST ?? '',
      partition: env.SCREEN_RPS_PARTITION ?? 'TEST_A',
      display: env.SCREEN_DISPLAY ?? ':99',
    },
  };
}

/**
 * Deterministic-world guard: replay must target a test partition, never the operational one.
 * Throws if the resolved partition is `PROD`.
 */
export function assertTestPartition(config) {
  const partition = config?.screen?.partition ?? '';
  if (partition.toUpperCase() === 'PROD') {
    throw new Error(
      'Refusing to run: SCREEN_RPS_PARTITION resolves to PROD (operational). Use a test partition (TEST_A/TEST_B/TEST_C).',
    );
  }
  return partition;
}

/**
 * Load optional per-project gate/lane settings from `multilane.config.json`. Missing file or fields
 * fall back to the documented defaults, so an untouched consumer project still verifies cleanly.
 */
export function loadProjectConfig(cwd = process.cwd()) {
  let user = {};
  try {
    user = JSON.parse(readFileSync(join(cwd, 'multilane.config.json'), 'utf8'));
  } catch {
    // No project config — defaults apply.
  }
  return {
    runtimeDirs: asStringArray(user.runtimeDirs, DEFAULT_RUNTIME_DIRS),
    authoringDirs: asStringArray(user.authoringDirs, DEFAULT_AUTHORING_DIRS),
    specDir: typeof user.specDir === 'string' ? user.specDir : DEFAULT_SPEC_DIR,
    contractDoc: typeof user.contractDoc === 'string' ? user.contractDoc : DEFAULT_CONTRACT_DOC,
    robotTags: asStringArray(user.robotTags, []),
    lanes: asStringArray(user.lanes, []),
  };
}

function splitList(value) {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function asStringArray(value, fallback) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : fallback;
}
