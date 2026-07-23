// @multilane/core — screen-partition hard guard.
//
// This is a safety-critical refusal, not a configuration default. `loadConfig` resolves
// `SCREEN_RPS_PARTITION` to `TEST_A` when unset — a sane default for local/dev convenience — but a
// default is one `export SCREEN_RPS_PARTITION=PROD` away from being overridden. PROD is the live
// operational partition; the screen lane must never replay against it under any circumstance.
//
// This gate makes that refusal mandatory and fail-loud at the `mlt verify` boundary, ahead of any
// lane running, whenever the screen lane is active (declared in `multilane.config.json` lanes, or
// `SCREEN_TARGET_HOST` is set). It does not rely on a consumer test remembering to call
// `assertTestPartition` — `@multilane/screen`'s `loadFrozenLocator` also calls it directly on every
// locator load, so the guard holds even if a spec runs outside `mlt verify` (e.g. `npm run
// test:screen` in isolation).
import { loadConfig, assertTestPartition } from '../config.mjs';

/**
 * @returns {{ ok: boolean, active: boolean, partition: string|null, error?: string }}
 */
export function runScreenPartitionGate({ env = process.env, lanes = [] } = {}) {
  const screenActive = lanes.includes('screen') || Boolean(env.SCREEN_TARGET_HOST);
  if (!screenActive) {
    return { ok: true, active: false, partition: null };
  }
  const config = loadConfig(env);
  try {
    const partition = assertTestPartition(config);
    return { ok: true, active: true, partition };
  } catch (err) {
    return { ok: false, active: true, partition: config.screen.partition, error: err.message };
  }
}

/**
 * Print the screen-partition guard result and return whether it passed.
 * @returns {boolean}
 */
export function reportScreenPartition(result) {
  if (!result.active) {
    console.log('✓ screen-partition guard: screen lane not active — skipped.');
    return true;
  }
  if (!result.ok) {
    console.error(`✖ screen-partition guard FAILED — ${result.error}`);
    console.error(
      'Refusing to start the screen lane. This is a safety-critical refusal, not a default — fix ' +
        'SCREEN_RPS_PARTITION and re-run.',
    );
    return false;
  }
  console.log(`✓ screen-partition guard passed — SCREEN_RPS_PARTITION=${result.partition}.`);
  return true;
}
