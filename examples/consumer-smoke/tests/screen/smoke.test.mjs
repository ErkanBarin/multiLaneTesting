import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrozenLocator, assertFrozen } from '@erkanbarin/screen';

// Smoke: the PACKAGED @erkanbarin/screen loads a frozen locator and validates it (Tier 1/2 + refs).
test('packaged @erkanbarin/screen loads and validates a frozen locator', () => {
  const locator = loadFrozenLocator('example', 'appTitle');
  assert.equal(assertFrozen(locator).ok, true);
  assert.equal(locator.requirement_ref, 'REQ_EXAMPLE_0001');
});
