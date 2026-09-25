import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateModel } from '../index.mjs';
import { smallModel, mediumModel, edgeCaseModel } from './fixtures.mjs';

const fixtures = { smallModel, mediumModel, edgeCaseModel };

for (const [label, model] of Object.entries(fixtures)) {
  test(`${label} validates cleanly`, () => {
    assert.deepEqual(validateModel(model), []);
  });

  test(`${label} survives a JSON roundtrip byte-identically`, () => {
    const roundTripped = JSON.parse(JSON.stringify(model));
    assert.deepEqual(roundTripped, model);
    assert.deepEqual(validateModel(roundTripped), []);
  });
}

// Schema stability: the top-level and nested shapes a consumer can rely on across versions.
test('EmulatedAgentModel top-level keys are stable', () => {
  const expectedKeys = ['subsystem', 'confFile', 'smiFile', 'hostTypes', 'scalars', 'tables', 'notifications', 'gaps'].sort();
  assert.deepEqual(Object.keys(mediumModel).sort(), expectedKeys);
});

test('EmulatedScalar keys are stable', () => {
  const expectedKeys = ['name', 'oid', 'readOnly', 'initial', 'usedBy'].sort();
  assert.deepEqual(Object.keys(mediumModel.scalars[0]).sort(), expectedKeys);
});

test('EmulatedTable and EmulatedColumn keys are stable', () => {
  const table = mediumModel.tables[0];
  assert.deepEqual(Object.keys(table).sort(), ['name', 'entryOid', 'columns', 'index', 'rows', 'usedBy'].sort());
  assert.deepEqual(Object.keys(table.columns[0]).sort(), ['name', 'number', 'type', 'readOnly'].sort());
  assert.deepEqual(Object.keys(table.columns[1]).sort(), ['name', 'number', 'type', 'readOnly', 'enumValues'].sort());
});

test('EmulatedNotification keys are stable', () => {
  assert.deepEqual(Object.keys(mediumModel.notifications[0]).sort(), ['name', 'oid', 'objects'].sort());
});

test('ModelGap keys are stable', () => {
  assert.deepEqual(Object.keys(edgeCaseModel.gaps[0]).sort(), ['identifier', 'reason', 'usedBy'].sort());
});
