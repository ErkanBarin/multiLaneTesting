import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionModel, SelectionAdapterError } from '../index.mjs';

const mib = `
demoMib OBJECT IDENTIFIER ::= { enterprises 99999 }
demoStatus OBJECT-TYPE
  SYNTAX INTEGER { up(1), down(2) }
  MAX-ACCESS read-write
  ::= { demoMib 1 }
demoConnectionsTable OBJECT-TYPE
  SYNTAX SEQUENCE OF DemoConnectionEntry
  MAX-ACCESS not-accessible
  ::= { demoMib 2 }
demoConnectionEntry OBJECT-TYPE
  SYNTAX DemoConnectionEntry
  MAX-ACCESS not-accessible
  INDEX { demoConnectionIndex }
  ::= { demoConnectionsTable 1 }
demoConnectionIndex OBJECT-TYPE
  SYNTAX Integer32
  MAX-ACCESS read-only
  ::= { demoConnectionEntry 1 }
demoConnectionState OBJECT-TYPE
  SYNTAX INTEGER { connected(1), disconnected(2) }
  MAX-ACCESS read-write
  ::= { demoConnectionEntry 2 }
demoStatusChange NOTIFICATION-TYPE
  OBJECTS { demoStatus }
  ::= { demoMib 3 }
`;

test('buildSelectionModel converts a selection list and MIB into a validated model', () => {
  const result = buildSelectionModel({
    selectionText: 'subsystem demo\nhostType manager:v2c\nscalar demoStatus=down\ntable demoConnectionsTable\nnotification demoStatusChange',
    mib,
  });

  assert.deepEqual(result.model.hostTypes, [{ name: 'manager', version: 'v2c' }]);
  assert.deepEqual(result.model.scalars[0], {
    name: 'demoStatus', oid: '1.3.6.1.4.1.99999.1', readOnly: false, enumValues: { up: 1, down: 2 },
    initial: { type: 'Integer', value: 2, enumLabel: 'down' }, usedBy: [],
  });
  assert.deepEqual(result.model.tables[0].index, ['demoConnectionIndex']);
  assert.deepEqual(result.model.notifications[0].objects, ['demoStatus']);
  assert.deepEqual(result.gaps, []);
});

test('buildSelectionModel reports unresolved selections as gaps', () => {
  const result = buildSelectionModel({ selectionText: 'scalar missingObject', mib });
  assert.deepEqual(result.gaps, [{ identifier: 'missingObject', reason: 'not declared in loaded SMI/MIB input', usedBy: [] }]);
});

test('buildSelectionModel refuses unsupported directives rather than returning an empty model', () => {
  const unsupportedInput = [
    'hostType "DEMO" "" "v2c" "public"',
    'obj "demoServer" "DEMO Server"',
    'objField "demoServer" "state" "demoState"',
  ].join('\n');
  assert.throws(() => buildSelectionModel({ selectionText: unsupportedInput, mib }), SelectionAdapterError);
  assert.throws(() => buildSelectionModel({ selectionText: unsupportedInput, mib }), /obj, objField/);
});

test('buildSelectionModel records a partially-understood conf as gaps instead of under-reporting', () => {
  const result = buildSelectionModel({ selectionText: 'scalar demoStatus=down\nunsupported "x"', mib });
  assert.equal(result.model.scalars.length, 1);
  assert.ok(result.gaps.some((gap) => gap.identifier === 'unsupported'), 'dropped directive must surface as a gap');
});

test('buildSelectionModel requires explicit input instead of a repository-path assumption', () => {
  assert.throws(() => buildSelectionModel({ mib }), SelectionAdapterError);
  assert.throws(() => buildSelectionModel({ selectionText: '', selectionPath: 'fixture.conf', mib }), /exactly one/);
});