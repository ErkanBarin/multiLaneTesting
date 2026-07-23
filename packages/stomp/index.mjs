// @multilane/stomp — STOMP-over-WebSocket contract lane.
//
// Passive SUBSCRIBE is the default. Active SEND is gated: it requires an explicit inject opt-in AND
// an approved-hosts allowlist match — mirroring MULTILANE_WS_INJECT=1 + approved-host preflight.
//
// Peer deps (@stomp/stompjs, ws) are imported lazily so this module loads even where they are not
// installed (e.g. a scan or a skipped test).

/**
 * Subscribe and resolve with the first frame received on a destination.
 * @param {string} url  STOMP-over-WS broker URL
 * @param {string} destination
 * @param {{ timeoutMs?: number, headers?: Record<string, string> }} [options]
 * @returns {Promise<{ headers: object, body: string }>}
 */
export async function subscribeOnce(url, destination, { timeoutMs = 5000, headers = {} } = {}) {
  const { Client } = await import('@stomp/stompjs');
  const WS = (await import('ws')).default;

  return new Promise((resolve, reject) => {
    const client = new Client({
      brokerURL: url,
      webSocketFactory: () => new WS(url),
      reconnectDelay: 0,
    });
    const settle = makeSettler(client, resolve, reject);
    settle.timer = setTimeout(
      () => settle.reject(new Error(`subscribeOnce timed out after ${timeoutMs}ms on ${destination}`)),
      timeoutMs,
    );

    client.onConnect = () => {
      client.subscribe(
        destination,
        (message) => settle.resolve({ headers: message.headers, body: message.body }),
        headers,
      );
    };
    client.onStompError = (frame) => settle.reject(new Error(frame?.headers?.message ?? 'STOMP error'));
    client.onWebSocketError = (event) =>
      settle.reject(new Error(`WebSocket error connecting to broker: ${event?.message ?? 'connection failed'}`));
    client.onWebSocketClose = (event) =>
      settle.reject(new Error(`WebSocket closed before the STOMP session completed (code ${event?.code ?? 'unknown'}).`));

    client.activate();
  });
}

/**
 * Supervised active SEND. Refuses unless `inject` is true and the host is on the allowlist.
 * @param {string} url
 * @param {string} destination
 * @param {string} body
 * @param {{ inject?: boolean, approvedHosts?: string[], headers?: Record<string, string>, timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export async function send(url, destination, body, { inject = false, approvedHosts = [], headers = {}, timeoutMs = 5000 } = {}) {
  if (!inject) {
    throw new Error('Active SEND refused: pass inject:true (MULTILANE_WS_INJECT=1) to enable it.');
  }
  const { host } = new URL(url);
  if (approvedHosts.length === 0 || !approvedHosts.includes(host)) {
    throw new Error(`Active SEND refused: host ${host} is not on the approved-hosts allowlist.`);
  }

  const { Client } = await import('@stomp/stompjs');
  const WS = (await import('ws')).default;

  await new Promise((resolve, reject) => {
    const client = new Client({
      brokerURL: url,
      webSocketFactory: () => new WS(url),
      reconnectDelay: 0,
    });
    const settle = makeSettler(client, resolve, reject);
    settle.timer = setTimeout(
      () => settle.reject(new Error(`send timed out after ${timeoutMs}ms connecting to ${destination}`)),
      timeoutMs,
    );
    client.onConnect = () => {
      client.publish({ destination, body, headers });
      settle.resolve();
    };
    client.onStompError = (frame) => settle.reject(new Error(frame?.headers?.message ?? 'STOMP error'));
    client.onWebSocketError = (event) =>
      settle.reject(new Error(`WebSocket error connecting to broker: ${event?.message ?? 'connection failed'}`));
    client.onWebSocketClose = (event) =>
      settle.reject(new Error(`WebSocket closed before the STOMP session completed (code ${event?.code ?? 'unknown'}).`));
    client.activate();
  });
}

// One-shot settlement: whichever lifecycle callback fires first wins; every later callback
// (including the close event emitted by our own teardown) is a guarded no-op.
function makeSettler(client, resolve, reject) {
  const settle = {
    done: false,
    timer: undefined,
    resolve: (value) => complete(resolve, value),
    reject: (err) => complete(reject, err),
  };
  function complete(fn, value) {
    if (settle.done) return;
    settle.done = true;
    clearTimeout(settle.timer);
    deactivate(client);
    fn(value);
  }
  return settle;
}

function deactivate(client) {
  try {
    client.deactivate();
  } catch {
    /* best-effort teardown */
  }
}
