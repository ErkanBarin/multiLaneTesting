// Shared fixtures for the @multilane/snmp-runtime tests. The agent and the trap listener are two
// halves of one runtime, so they exercise the same model rather than drifting apart.
import { createSocket } from 'node:dgram';

/** A free loopback UDP port, released immediately so the caller can bind it. */
export async function freeUdpPort() {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    socket.bind(0, '127.0.0.1');
    socket.on('listening', () => {
      const { port } = socket.address();
      socket.close(() => resolve(port));
    });
    socket.on('error', reject);
  });
}

export function fixtureModel() {
  return {
    subsystem: 'fixture',
    confFile: '',
    smiFile: '',
    hostTypes: [{ name: 'fixture', version: 'v2c' }],
    scalars: [
      {
        name: 'fixtureStatus',
        oid: '1.3.6.1.4.1.9999.1',
        readOnly: true,
        enumValues: { up: 1, down: 2 },
        initial: { type: 'Integer', value: 1, enumLabel: 'up' },
        usedBy: ['fixtureStatus'],
      },
    ],
    tables: [
      {
        name: 'fixtureConnTable',
        entryOid: '1.3.6.1.4.1.9999.2.1',
        columns: [
          { name: 'fixtureConnIndex', number: 1, type: 'Integer', readOnly: true },
          { name: 'fixtureConnState', number: 2, type: 'Integer', readOnly: false, enumValues: { connected: 1, disconnected: 2 } },
        ],
        index: ['fixtureConnIndex'],
        rows: [],
        usedBy: ['fixtureConnTable'],
      },
    ],
    notifications: [
      {
        name: 'fixtureStatusChange',
        oid: '1.3.6.1.4.1.9999.3.1',
        objects: ['fixtureStatus'],
      },
    ],
    gaps: [],
  };
}
