import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertShape } from '@erkanbarin/http';

// Smoke: the PACKAGED @erkanbarin/http imports and validates a response shape. No host, no network.
test('packaged @erkanbarin/http validates a response shape', () => {
  assert.equal(assertShape({ status: 'ok', count: 3 }, { status: 'string', count: 'number' }).ok, true);
  assert.equal(assertShape({}, { status: 'string' }).ok, false);
});
