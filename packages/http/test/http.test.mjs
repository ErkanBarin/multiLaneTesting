// @multilane/http — tests against a local emulator (no live network target required).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getJson, assertShape, assertApprovedHost } from '../index.mjs';
import { startHttpEmulator } from './support/emulator.mjs';

test('getJson returns parsed JSON body, status, and headers from a live server', async () => {
  const emulator = await startHttpEmulator({ '/health': { status: 200, body: { status: 'ok', version: 1 } } });
  try {
    const { status, body, headers } = await getJson(`${emulator.url}/health`);
    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'ok', version: 1 });
    assert.equal(headers['content-type'], 'application/json');
  } finally {
    await emulator.close();
  }
});

test('getJson returns raw text for a non-JSON payload', async () => {
  const emulator = await startHttpEmulator({ '/plain': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'plain text' } });
  try {
    const { body } = await getJson(`${emulator.url}/plain`);
    assert.equal(body, 'plain text');
  } finally {
    await emulator.close();
  }
});

test('getJson surfaces a non-200 status without throwing', async () => {
  const emulator = await startHttpEmulator({});
  try {
    const { status, body } = await getJson(`${emulator.url}/missing`);
    assert.equal(status, 404);
    assert.equal(body.error, 'not found');
  } finally {
    await emulator.close();
  }
});

test('getJson forwards custom request headers', async () => {
  const emulator = await startHttpEmulator({
    '/echo-auth': (req) => ({ body: { authorization: req.headers['authorization'] ?? null } }),
  });
  try {
    const { body } = await getJson(`${emulator.url}/echo-auth`, { headers: { authorization: 'Bearer test-token' } });
    assert.equal(body.authorization, 'Bearer test-token');
  } finally {
    await emulator.close();
  }
});

test('assertApprovedHost allows a host on the allowlist and rejects others', async () => {
  const emulator = await startHttpEmulator({ '/health': { body: { ok: true } } });
  try {
    const host = new URL(emulator.url).host;
    assert.doesNotThrow(() => assertApprovedHost(`${emulator.url}/health`, [host]));
    assert.throws(() => assertApprovedHost(`${emulator.url}/health`, ['not-this-host']), /not in the approved-hosts allowlist/);
  } finally {
    await emulator.close();
  }
});

test('assertApprovedHost is a no-op when no allowlist is provided', async () => {
  const emulator = await startHttpEmulator({ '/health': { body: { ok: true } } });
  try {
    assert.doesNotThrow(() => assertApprovedHost(`${emulator.url}/health`));
  } finally {
    await emulator.close();
  }
});

test('assertShape reports missing keys and type mismatches', () => {
  const result = assertShape({ status: 'ok', count: '3' }, { status: 'string', count: 'number' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['key "count" expected number, got string']);
});

test('assertShape passes for a matching structural shape', () => {
  const result = assertShape({ status: 'ok', count: 3 }, { status: 'string', count: 'number' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('getJson rejects after timeoutMs when the server never responds', async () => {
  const { createServer } = await import('node:http');
  const server = createServer(() => {
    // accept the request, never respond
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assert.rejects(
      getJson(`http://127.0.0.1:${port}/never`, { timeoutMs: 200 }),
      /timed out after 200 ms/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('getJson rejects when the response body exceeds maxBodyBytes', async () => {
  const emulator = await startHttpEmulator({
    '/big': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'x'.repeat(5000) },
  });
  try {
    await assert.rejects(
      getJson(`${emulator.url}/big`, { maxBodyBytes: 1000 }),
      /exceeded maxBodyBytes/,
    );
  } finally {
    await emulator.close();
  }
});
