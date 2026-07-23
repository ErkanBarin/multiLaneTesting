import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';

const TEST_ENV = { SCREEN_RPS_PARTITION: 'TEST_A' };

function makeLocatorFixture(area, key, record) {
  const cwd = mkdtempSync(join(tmpdir(), 'screen-test-'));
  mkdirSync(join(cwd, 'locators', area), { recursive: true });
  writeFileSync(join(cwd, 'locators', area, `${key}.json`), JSON.stringify(record));
  return cwd;
}

test('loadFrozenLocator reads a frozen locator record', () => {
  const record = { tier: 1, resolver: 'object-id', requirement_ref: 'REQ_001' };
  const cwd = makeLocatorFixture('samplePanel', 'submitButton', record);
  try {
    const loaded = loadFrozenLocator('samplePanel', 'submitButton', { cwd, env: TEST_ENV });
    assert.deepEqual(loaded, record);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadFrozenLocator refuses when partition resolves to PROD', () => {
  assert.throws(
    () => loadFrozenLocator('samplePanel', 'submitButton', { env: { SCREEN_RPS_PARTITION: 'PROD' } }),
    /Refusing to run: SCREEN_RPS_PARTITION resolves to PROD/,
  );
});

test('loadFrozenLocator rejects path traversal and non-segment inputs', () => {
  for (const bad of ['../../etc', 'a/b', '..', '.hidden', '', 'a b', 'a\\b']) {
    assert.throws(
      () => loadFrozenLocator(bad, 'key', { env: TEST_ENV }),
      /Invalid locator area/,
      `area ${JSON.stringify(bad)} should be rejected`,
    );
    assert.throws(
      () => loadFrozenLocator('area', bad, { env: TEST_ENV }),
      /Invalid locator key/,
      `key ${JSON.stringify(bad)} should be rejected`,
    );
  }
  assert.throws(() => loadFrozenLocator(null, 'key', { env: TEST_ENV }), /Invalid locator area/);
  assert.throws(() => loadFrozenLocator('area', 42, { env: TEST_ENV }), /Invalid locator key/);
});

test('loadFrozenLocator refuses a symlinked area that escapes the locator root', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'screen-test-'));
  const outside = mkdtempSync(join(tmpdir(), 'screen-outside-'));
  try {
    writeFileSync(join(outside, 'stolen.json'), JSON.stringify({ tier: 1 }));
    mkdirSync(join(cwd, 'locators'), { recursive: true });
    symlinkSync(outside, join(cwd, 'locators', 'evil'), 'dir');
    assert.throws(
      () => loadFrozenLocator('evil', 'stolen', { cwd, env: TEST_ENV }),
      /resolves outside locators\//,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('assertFrozen accepts a valid Tier-1/2 locator', () => {
  for (const tier of [1, 2]) {
    const result = assertFrozen({ tier, resolver: 'object-id', requirement_ref: 'REQ_001' });
    assert.deepEqual(result, { ok: true, errors: [] });
  }
});

test('assertFrozen rejects missing fields and bad tiers', () => {
  assert.equal(assertFrozen(null).ok, false);
  assert.equal(assertFrozen('nope').ok, false);

  const result = assertFrozen({ tier: 3 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('tier must be 1 or 2')));
  assert.ok(result.errors.some((e) => e.includes('resolver is required')));
  assert.ok(result.errors.some((e) => e.includes('requirement_ref is required')));
});
