import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';

// Smoke: the PACKAGED @multilane/screen loads a frozen locator and validates it (Tier 1/2 + refs).
test('packaged @multilane/screen loads and validates a frozen locator', () => {
  const locator = loadFrozenLocator('example', 'appTitle');
  assert.equal(assertFrozen(locator).ok, true);
  assert.equal(locator.requirement_ref, 'REQ_EXAMPLE_0001');
});
