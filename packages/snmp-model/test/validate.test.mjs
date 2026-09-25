import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateModel } from '../index.mjs';

function baseModel(overrides = {}) {
  return {
    subsystem: 'example',
    confFile: '',
    smiFile: '',
    hostTypes: [{ name: 'example', version: 'v2c' }],
    scalars: [],
    tables: [],
    notifications: [],
    gaps: [],
    ...overrides,
  };
}

test('validateModel accepts an empty model', () => {
  assert.deepEqual(validateModel(baseModel()), []);
});

test('validateModel flags duplicate scalar names and OIDs', () => {
  const scalar = { name: 'a', oid: '1.2.3', readOnly: true, initial: { type: 'Integer', value: 1 }, usedBy: [] };
  const errors = validateModel(baseModel({ scalars: [scalar, { ...scalar }] }));
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /duplicate scalar name/);
  assert.match(errors[1].message, /duplicate scalar OID/);
});

test('validateModel flags a table with no index columns', () => {
  const table = { name: 't', entryOid: '1.2.3.1', columns: [], index: [], rows: [], usedBy: [] };
  const errors = validateModel(baseModel({ tables: [table] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /declares no index columns/);
});

test('validateModel flags duplicate column numbers and a row/column length mismatch', () => {
  const table = {
    name: 't',
    entryOid: '1.2.3.1',
    columns: [
      { name: 'idx', number: 1, type: 'Integer', readOnly: true },
      { name: 'val', number: 1, type: 'Integer', readOnly: false },
    ],
    index: ['idx'],
    rows: [[1]],
    usedBy: [],
  };
  const errors = validateModel(baseModel({ tables: [table] }));
  assert.equal(errors.length, 2);
  assert.match(errors.map((e) => e.message).join(';'), /duplicate column number/);
  assert.match(errors.map((e) => e.message).join(';'), /table "t" declares 2 columns/);
});

test('validateModel flags a notification carrying an object nothing declares', () => {
  const errors = validateModel(baseModel({ notifications: [{ name: 'n', oid: '1.2.3.4', objects: ['missing'] }] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /which no scalar or table column declares/);
});

test('validateModel accepts a notification object that resolves to a table column', () => {
  const table = {
    name: 't',
    entryOid: '1.2.3.1',
    columns: [{ name: 'val', number: 1, type: 'Integer', readOnly: true }],
    index: ['idx'],
    rows: [],
    usedBy: [],
  };
  const errors = validateModel(baseModel({ tables: [table], notifications: [{ name: 'n', oid: '1.2.3.4', objects: ['val'] }] }));
  assert.deepEqual(errors, []);
});
