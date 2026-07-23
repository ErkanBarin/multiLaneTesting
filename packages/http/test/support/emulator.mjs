// @multilane/http — a throwaway local HTTP server for deterministic, offline tests of this
// package's client helpers. Test-only: never shipped (this package's "files" allowlist excludes
// test/), never used at runtime by a consumer's own tests.
import { createServer } from 'node:http';

/**
 * Start a minimal local HTTP server that serves canned responses by exact path. A route may be a
 * plain `{ status, headers, body }` object, or a function `(req) => { status, headers, body }` for
 * responses that need to inspect the incoming request (e.g. echoing a header back).
 * @param {Record<string, object | ((req: import('node:http').IncomingMessage) => object)>} routes
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function startHttpEmulator(routes = {}) {
  const server = createServer((req, res) => {
    const routeOrFn = routes[req.url];
    if (!routeOrFn) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found', path: req.url }));
      return;
    }
    const route = typeof routeOrFn === 'function' ? routeOrFn(req) : routeOrFn;
    const { status = 200, headers = { 'content-type': 'application/json' }, body = {} } = route;
    res.writeHead(status, headers);
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
