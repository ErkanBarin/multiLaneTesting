import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startEmulatedAgent, startTrapListener } from '../index.mjs';
import { freeUdpPort, fixtureModel } from './fixtures.mjs';

// The two halves of the runtime, closing the loop: the agent emits the notification its model
// declares, the listener decodes it. `agent-runtime.test.mjs` proves emit() puts bytes on the
// wire without the listener; this proves what those bytes say.
test('a listener decodes the varbinds an emitted notification declares', async () => {
  const agentPort = await freeUdpPort();
  const trapPort = await freeUdpPort();
  const listener = startTrapListener({ port: trapPort });
  const agent = startEmulatedAgent({
    model: fixtureModel(),
    port: agentPort,
    community: 'test-only',
    trapTarget: { port: trapPort, community: 'test-only' },
  });

  try {
    agent.set('fixtureStatus', 'down');
    await agent.emit('fixtureStatusChange');

    const trap = await listener.waitForTrap(
      (n) => n.varbinds.some((vb) => vb.oid === '1.3.6.1.4.1.9999.1.0'),
      5_000,
    );
    assert.equal(trap.source.address, '127.0.0.1');
    const status = trap.varbinds.find((vb) => vb.oid === '1.3.6.1.4.1.9999.1.0');
    // The model says fixtureStatusChange carries fixtureStatus, and set() moved it to down = 2.
    assert.equal(String(status.value), '2');
    assert.equal(listener.received.length, 1);
  } finally {
    agent.close();
    listener.close();
  }
});

test('waitForTrap rejects rather than hanging when nothing arrives', async () => {
  const listener = startTrapListener({ port: await freeUdpPort() });
  try {
    await assert.rejects(
      listener.waitForTrap(() => true, 50),
      /no matching trap received within 50ms/,
    );
  } finally {
    listener.close();
  }
});

test('close() fails a pending wait instead of leaving it outstanding', async () => {
  const listener = startTrapListener({ port: await freeUdpPort() });
  // A long timeout the test would have to sit through if close() did not settle the waiter.
  const pending = listener.waitForTrap(() => true, 60_000);
  listener.close();
  await assert.rejects(pending, /closed while waiting/);
});
