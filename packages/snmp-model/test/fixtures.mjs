// Small, medium, and edge-case fixture models shared by roundtrip/schema-stability tests.

/** @type {import('../index.d.ts').EmulatedAgentModel} */
export const smallModel = {
  subsystem: 'small',
  confFile: '',
  smiFile: '',
  hostTypes: [{ name: 'small', version: 'v2c' }],
  scalars: [
    {
      name: 'smallStatus',
      oid: '1.3.6.1.4.1.1.1',
      readOnly: true,
      enumValues: { up: 1, down: 2 },
      initial: { type: 'Integer', value: 1, enumLabel: 'up' },
      usedBy: ['smallStatus'],
    },
  ],
  tables: [],
  notifications: [],
  gaps: [],
};

/** @type {import('../index.d.ts').EmulatedAgentModel} */
export const mediumModel = {
  subsystem: 'medium',
  confFile: 'MicMedium.conf',
  smiFile: 'medium.mib',
  hostTypes: [{ name: 'medium', version: 'v2c' }],
  scalars: [
    {
      name: 'mediumAgentSwVersion',
      oid: '1.3.6.1.4.1.2.1',
      readOnly: true,
      initial: { type: 'OctetString', value: '1.0.0' },
      usedBy: ['mediumAgentSwVersion'],
    },
  ],
  tables: [
    {
      name: 'mediumConnTable',
      entryOid: '1.3.6.1.4.1.2.2.1',
      columns: [
        { name: 'mediumConnIndex', number: 1, type: 'Integer', readOnly: true },
        { name: 'mediumConnState', number: 2, type: 'Integer', readOnly: false, enumValues: { connected: 1, disconnected: 2 } },
      ],
      index: ['mediumConnIndex'],
      rows: [[1, 1]],
      usedBy: ['mediumConnTable'],
    },
  ],
  notifications: [
    {
      name: 'mediumConnStateChange',
      oid: '1.3.6.1.4.1.2.3.1',
      objects: ['mediumConnIndex', 'mediumConnState'],
    },
  ],
  gaps: [],
};

/** @type {import('../index.d.ts').EmulatedAgentModel} */
export const edgeCaseModel = {
  subsystem: 'edge',
  confFile: 'MicEdge.conf',
  smiFile: 'edge.mib',
  hostTypes: [{ name: 'edge', version: 'v2c' }],
  scalars: [],
  tables: [
    {
      // AUGMENTS chain: indexed by a column that does not appear in this table's own columns.
      name: 'edgeAugmentedTable',
      entryOid: '1.3.6.1.4.1.3.1.1',
      columns: [{ name: 'edgeExtra', number: 1, type: 'Counter64', readOnly: true }],
      index: ['foreignIndex'],
      rows: [],
      usedBy: ['edgeAugmentedTable'],
    },
  ],
  notifications: [],
  gaps: [{ identifier: 'edgeUnresolvedObject', reason: 'not declared in any loaded MIB module', usedBy: ['MicEdge.conf'] }],
};
