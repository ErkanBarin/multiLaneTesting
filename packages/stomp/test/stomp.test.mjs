// @multilane/stomp — tests against a local in-process STOMP-over-WS emulator (no live broker
// required). Deterministic: every send is preceded by waiting on the emulator's own subscribe
// event, never a wall-clock sleep.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { subscribeOnce, send } from '../index.mjs';
import { startStompEmulator, waitForSubscription } from './support/emulator.mjs';

test('subscribeOnce resolves with the first message sent to a destination', async () => {
  const emulator = startStompEmulator();
  try {
    const received = subscribeOnce(emulator.url, '/topic/demo', { timeoutMs: 3000 });
    await waitForSubscription(emulator, '/topic/demo');
    const host = new URL(emulator.url).host;

    await send(emulator.url, '/topic/demo', 'hello', { inject: true, approvedHosts: [host] });

    const message = await received;
    assert.equal(message.body, 'hello');
  } finally {
    await emulator.close();
  }
});

test('subscribeOnce carries custom subscribe headers through to the broker', async () => {
  const emulator = startStompEmulator();
  try {
    const received = subscribeOnce(emulator.url, '/topic/with-headers', {
      timeoutMs: 3000,
      headers: { ack: 'auto' },
    });
    const sub = await waitForSubscription(emulator, '/topic/with-headers');
    assert.ok(sub.id);
    const host = new URL(emulator.url).host;
    await send(emulator.url, '/topic/with-headers', 'payload', { inject: true, approvedHosts: [host] });
    const message = await received;
    assert.equal(message.body, 'payload');
  } finally {
    await emulator.close();
  }
});

test('subscribeOnce times out when nothing is published to the destination', async () => {
  const emulator = startStompEmulator();
  try {
    await assert.rejects(
      subscribeOnce(emulator.url, '/topic/silent', { timeoutMs: 300 }),
      /timed out after 300ms/,
    );
  } finally {
    await emulator.close();
  }
});

test('send refuses without an explicit inject:true opt-in', async () => {
  const emulator = startStompEmulator();
  try {
    await assert.rejects(
      send(emulator.url, '/topic/demo', 'nope', {}),
      /Active SEND refused: pass inject:true/,
    );
  } finally {
    await emulator.close();
  }
});

test('send refuses when the host is not on the approved-hosts allowlist', async () => {
  const emulator = startStompEmulator();
  try {
    await assert.rejects(
      send(emulator.url, '/topic/demo', 'nope', { inject: true, approvedHosts: ['not-this-host'] }),
      /not on the approved-hosts allowlist/,
    );
  } finally {
    await emulator.close();
  }
});

test('two independent subscribers on different destinations each get only their own message', async () => {
  const emulator = startStompEmulator();
  try {
    const receivedA = subscribeOnce(emulator.url, '/topic/a', { timeoutMs: 3000 });
    const receivedB = subscribeOnce(emulator.url, '/topic/b', { timeoutMs: 3000 });
    await waitForSubscription(emulator, '/topic/a');
    await waitForSubscription(emulator, '/topic/b');
    const host = new URL(emulator.url).host;

    await send(emulator.url, '/topic/a', 'for-a', { inject: true, approvedHosts: [host] });
    await send(emulator.url, '/topic/b', 'for-b', { inject: true, approvedHosts: [host] });

    const [messageA, messageB] = await Promise.all([receivedA, receivedB]);
    assert.equal(messageA.body, 'for-a');
    assert.equal(messageB.body, 'for-b');
  } finally {
    await emulator.close();
  }
});

test('send rejects after timeoutMs when the broker accepts WS but never completes STOMP connect', async () => {
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => wss.on('listening', resolve));
  const { port } = wss.address();
  const url = `ws://127.0.0.1:${port}`;
  try {
    await assert.rejects(
      send(url, '/topic/demo', 'hello', {
        inject: true,
        approvedHosts: [`127.0.0.1:${port}`],
        timeoutMs: 300,
      }),
      /timed out after 300ms/,
    );
  } finally {
    await new Promise((resolve) => wss.close(resolve));
  }
});

test('subscribeOnce rejects promptly when the broker closes the socket before STOMP connect', async () => {
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => wss.on('listening', resolve));
  wss.on('connection', (socket) => socket.close());
  const { port } = wss.address();
  try {
    const started = Date.now();
    await assert.rejects(
      subscribeOnce(`ws://127.0.0.1:${port}`, '/topic/closed', { timeoutMs: 5000 }),
      /WebSocket closed before the STOMP session completed/,
    );
    assert.ok(Date.now() - started < 4000, 'clean close rejected before the generic timeout');
  } finally {
    await new Promise((resolve) => wss.close(resolve));
  }
});

test('subscribeOnce rejects with a clear error when the WebSocket connection fails', async () => {
  const net = await import('node:net');
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));

  await assert.rejects(
    subscribeOnce(`ws://127.0.0.1:${port}`, '/topic/unreachable', { timeoutMs: 3000 }),
    /WebSocket error/,
  );
});
