import { test } from 'node:test';
import assert from 'node:assert/strict';
import { send } from '@multilane/stomp';

// Smoke: the PACKAGED @multilane/stomp refuses active SEND without the inject opt-in and an
// approved-hosts allowlist match. Both guards throw before any connection — no broker, no network.
test('packaged @multilane/stomp refuses SEND without inject opt-in', async () => {
  await assert.rejects(
    send('ws://broker.example:15674/ws', '/topic/demo', '{}'),
    /Active SEND refused: pass inject:true/,
  );
});

test('packaged @multilane/stomp refuses SEND when host is not allowlisted', async () => {
  await assert.rejects(
    send('ws://broker.example:15674/ws', '/topic/demo', '{}', {
      inject: true,
      approvedHosts: ['other.example:15674'],
    }),
    /not on the approved-hosts allowlist/,
  );
});
