import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import * as snmp from 'net-snmp';

import { startEmulatedAgent } from '../index.mjs';
import { freeUdpPort, fixtureModel } from './fixtures.mjs';

async function getOid(port, community, oid) {
  const session = snmp.createSession('127.0.0.1', community, { port, version: snmp.Version2c, timeout: 500, retries: 0 });
  try {
    return await new Promise((resolve, reject) => {
      session.get([oid], (error, varbinds) => {
        if (error) return reject(error);
        if (snmp.isVarbindError(varbinds[0])) return reject(new Error(snmp.varbindError(varbinds[0])));
        resolve(varbinds[0]);
      });
    });
  } finally {
    session.close();
  }
}

test('startEmulatedAgent serves a scalar readable over real SNMP GET', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    const varbind = await getOid(port, 'test-only', '1.3.6.1.4.1.9999.1.0');
    assert.equal(varbind.value.toString(), '1');
  } finally {
    agent.close();
  }
});

test('set() mutates a scalar and accepts an enum label', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    agent.set('fixtureStatus', 'down');
    const varbind = await getOid(port, 'test-only', '1.3.6.1.4.1.9999.1.0');
    assert.equal(varbind.value.toString(), '2');
  } finally {
    agent.close();
  }
});

test('set() rejects a name the model does not declare', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    assert.throws(() => agent.set('notAScalar', 1), /no scalar "notAScalar"/);
  } finally {
    agent.close();
  }
});

test('addRow() registers a row readable via table column OID', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    agent.addRow('fixtureConnTable', { fixtureConnIndex: 1, fixtureConnState: 'connected' });
    const varbind = await getOid(port, 'test-only', '1.3.6.1.4.1.9999.2.1.2.1');
    assert.equal(varbind.value.toString(), '1');
  } finally {
    agent.close();
  }
});

test('removeRow() takes the row out of the table', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    agent.addRow('fixtureConnTable', { fixtureConnIndex: 1, fixtureConnState: 'connected' });
    agent.removeRow('fixtureConnTable', [1]);
    await assert.rejects(getOid(port, 'test-only', '1.3.6.1.4.1.9999.2.1.2.1'));
  } finally {
    agent.close();
  }
});

test('emit() sends a real UDP datagram to the trap target', async () => {
  const agentPort = await freeUdpPort();
  const trapPort = await freeUdpPort();
  const agent = startEmulatedAgent({
    model: fixtureModel(),
    port: agentPort,
    community: 'test-only',
    trapTarget: { port: trapPort, community: 'test-only' },
  });
  const listener = createSocket('udp4');
  try {
    const datagram = new Promise((resolve, reject) => {
      listener.on('message', resolve);
      listener.on('error', reject);
    });
    await new Promise((resolve, reject) => {
      listener.bind(trapPort, '127.0.0.1', resolve);
      listener.on('error', reject);
    });
    await agent.emit('fixtureStatusChange');
    const message = await datagram;
    // A BER-encoded SNMP trap PDU — content is opaque bytes, but arrival on the exact target
    // port proves the runtime addressed and sent the notification the model declares.
    assert.ok(message.length > 0);
  } finally {
    agent.close();
    listener.close();
  }
});

test('emit() rejects a notification name the model does not declare', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({
    model: fixtureModel(),
    port,
    community: 'test-only',
    trapTarget: { port: await freeUdpPort(), community: 'test-only' },
  });
  try {
    await assert.rejects(agent.emit('notARealTrap'), /no notification "notARealTrap"/);
  } finally {
    agent.close();
  }
});

test('goSilent()/resume() toggle whether the agent answers', async () => {
  const port = await freeUdpPort();
  const agent = startEmulatedAgent({ model: fixtureModel(), port, community: 'test-only' });
  try {
    agent.goSilent();
    await assert.rejects(getOid(port, 'test-only', '1.3.6.1.4.1.9999.1.0'));
    agent.resume();
    const varbind = await getOid(port, 'test-only', '1.3.6.1.4.1.9999.1.0');
    assert.equal(varbind.value.toString(), '1');
  } finally {
    agent.close();
  }
});
