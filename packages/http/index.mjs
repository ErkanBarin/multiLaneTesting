// @multilane/http — passive HTTP/JSON contract lane.
//
// Passive by design: this lane performs read-only GETs and asserts shape/status/headers. It never
// mutates target state. Uses only Node's built-in http/https — no third-party client, no AI.
import http from 'node:http';
import https from 'node:https';

/**
 * Enforce that a URL's host is on the approved allowlist (when one is provided).
 * @param {string} url
 * @param {string[]} [approvedHosts]
 */
export function assertApprovedHost(url, approvedHosts = []) {
  if (!approvedHosts || approvedHosts.length === 0) return;
  const { host } = new URL(url);
  if (!approvedHosts.includes(host)) {
    throw new Error(`Host ${host} is not in the approved-hosts allowlist.`);
  }
}

/**
 * Passive GET returning parsed JSON (or raw text) plus status and headers.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, approvedHosts?: string[] }} [options]
 * @returns {Promise<{ status: number, headers: object, body: unknown }>}
 */
export function getJson(url, { headers = {}, approvedHosts = [] } = {}) {
  assertApprovedHost(url, approvedHosts);
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let body = null;
        try {
          body = data ? JSON.parse(data) : null;
        } catch {
          body = data; // non-JSON payload — return raw text
        }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Minimal structural check: asserts `obj` has the keys of `shape` with matching typeof.
 * @param {Record<string, unknown>} obj
 * @param {Record<string, string>} shape  key -> expected typeof
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertShape(obj, shape) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { ok: false, errors: ['value is not an object'] };
  }
  for (const [key, type] of Object.entries(shape)) {
    if (!(key in obj)) errors.push(`missing key "${key}"`);
    else if (typeof obj[key] !== type) errors.push(`key "${key}" expected ${type}, got ${typeof obj[key]}`);
  }
  return { ok: errors.length === 0, errors };
}
