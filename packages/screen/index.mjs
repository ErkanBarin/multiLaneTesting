// @multilane/screen — screen-driver lane (deterministic runtime surface).
//
// The runtime surface only ever LOADS and VALIDATES frozen locators — no discovery, no vision, no
// model. Locator discovery/freezing is an authoring-time concern handled elsewhere. Actuation
// (input synthesis, capture, oracles) lives in the Python driver (see pyproject.toml); this module
// is the deterministic locator contract the specs replay against.
//
// Safety-critical guard: every locator load asserts the resolved SCREEN_RPS_PARTITION is not the
// operational partition (PROD). This is a hard refusal baked into the runtime entry point itself —
// not a default a consumer could accidentally bypass by skipping `mlt verify`. See
// @multilane/core's `assertTestPartition` / `runScreenPartitionGate` for the CI-level mirror of
// this same guard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, assertTestPartition } from '@multilane/core';

/**
 * Load a frozen locator record from `locators/<area>/<key>.json`.
 * Refuses (throws) if SCREEN_RPS_PARTITION resolves to PROD — safety-critical, not configurable away.
 * @param {string} area
 * @param {string} key
 * @param {{ cwd?: string, locatorsDir?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {object} the frozen locator record
 */
const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function loadFrozenLocator(
  area,
  key,
  { cwd = process.cwd(), locatorsDir = 'locators', env = process.env } = {},
) {
  assertTestPartition(loadConfig(env));
  for (const [name, value] of [['area', area], ['key', key]]) {
    if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
      throw new Error(`Invalid locator ${name} "${value}": must match ${SAFE_SEGMENT} (single path segment).`);
    }
  }
  const path = join(cwd, locatorsDir, area, `${key}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Validate a frozen locator: runtime replays Tier-1/2 only and requires a resolver + requirement_ref.
 * @param {object} locator
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertFrozen(locator) {
  const errors = [];
  if (!locator || typeof locator !== 'object') {
    return { ok: false, errors: ['locator is not an object'] };
  }
  if (![1, 2].includes(locator.tier)) {
    errors.push('tier must be 1 or 2 (runtime replays Tier-1/2 locators only)');
  }
  if (!locator.resolver) errors.push('resolver is required');
  if (!locator.requirement_ref) errors.push('requirement_ref is required');
  return { ok: errors.length === 0, errors };
}
