// @multilane/stomp — a minimal in-process STOMP-over-WebSocket broker for deterministic, offline
// tests of this package's client helpers. Test-only: never shipped (this package's "files"
// allowlist excludes test/), never used at runtime by a consumer's own tests. Implements only the
// subset of STOMP 1.2 this package's client actually exercises: CONNECT/STOMP -> CONNECTED,
// SUBSCRIBE, UNSUBSCRIBE, SEND -> MESSAGE fan-out, DISCONNECT -> optional RECEIPT.
import { EventEmitter } from 'node:events';
import { WebSocketServer } from 'ws';

const NULL_BYTE = '\0';

function parseFrame(raw) {
  const withoutNull = raw.endsWith(NULL_BYTE) ? raw.slice(0, -1) : raw.split(NULL_BYTE)[0];
  const [headerBlock, ...bodyParts] = withoutNull.split('\n\n');
  const body = bodyParts.join('\n\n');
  const [command, ...headerLines] = headerBlock.split('\n');
  const headers = {};
  for (const line of headerLines) {
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    headers[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return { command, headers, body };
}

function serializeFrame(command, headers = {}, body = '') {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}:${v}`)
    .join('\n');
  return `${command}\n${headerLines}\n\n${body}${NULL_BYTE}`;
}

/**
 * Start a minimal local STOMP-over-WS broker.
 * @returns {{ url: string, events: EventEmitter, close: () => Promise<void> }}
 */
export function startStompEmulator({ port = 0 } = {}) {
  const wss = new WebSocketServer({ port });
  const events = new EventEmitter();
  const subscriptionsByDestination = new Map(); // destination -> Set<{ ws, id }>
  let messageSeq = 0;

  wss.on('connection', (ws) => {
    const ownSubscriptions = [];

    ws.on('message', (data) => {
      const raw = data.toString('utf8');
      if (!raw || raw === '\n') return; // STOMP heartbeat, ignore

      const frame = parseFrame(raw);
      switch (frame.command) {
        case 'CONNECT':
        case 'STOMP':
          ws.send(serializeFrame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
          break;

        case 'SUBSCRIBE': {
          const destination = frame.headers.destination;
          const id = frame.headers.id;
          if (!subscriptionsByDestination.has(destination)) subscriptionsByDestination.set(destination, new Set());
          const sub = { ws, id };
          subscriptionsByDestination.get(destination).add(sub);
          ownSubscriptions.push({ destination, sub });
          events.emit('subscribe', { destination, id });
          break;
        }

        case 'UNSUBSCRIBE': {
          for (const subs of subscriptionsByDestination.values()) {
            for (const sub of subs) {
              if (sub.ws === ws && sub.id === frame.headers.id) subs.delete(sub);
            }
          }
          break;
        }

        case 'SEND': {
          const destination = frame.headers.destination;
          const subs = subscriptionsByDestination.get(destination) ?? new Set();
          for (const sub of subs) {
            sub.ws.send(
              serializeFrame(
                'MESSAGE',
                {
                  destination,
                  subscription: sub.id,
                  'message-id': `m-${++messageSeq}`,
                  'content-type': frame.headers['content-type'] ?? 'text/plain',
                },
                frame.body,
              ),
            );
          }
          events.emit('send', { destination, body: frame.body });
          break;
        }

        case 'DISCONNECT': {
          if (frame.headers.receipt) {
            ws.send(serializeFrame('RECEIPT', { 'receipt-id': frame.headers.receipt }));
          }
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      for (const { destination, sub } of ownSubscriptions) {
        subscriptionsByDestination.get(destination)?.delete(sub);
      }
    });
  });

  const address = wss.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return {
    url: `ws://127.0.0.1:${boundPort}`,
    events,
    close: () => new Promise((resolve) => wss.close(() => resolve())),
  };
}

/** Resolve once a SUBSCRIBE for `destination` has been registered on the emulator. */
export function waitForSubscription(emulator, destination, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emulator.events.off('subscribe', handler);
      reject(new Error(`Timed out waiting for a subscription to ${destination}`));
    }, timeoutMs);
    function handler(evt) {
      if (evt.destination !== destination) return;
      clearTimeout(timer);
      emulator.events.off('subscribe', handler);
      resolve(evt);
    }
    emulator.events.on('subscribe', handler);
  });
}
