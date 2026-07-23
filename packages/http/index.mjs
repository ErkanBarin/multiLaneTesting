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
 * Bounded by default: `timeoutMs` is an ABSOLUTE deadline for the whole request+response
 * (a slow-drip peer cannot keep it alive), and an oversized response rejects once
 * `maxBodyBytes` is exceeded.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, approvedHosts?: string[], timeoutMs?: number, maxBodyBytes?: number }} [options]
 * @returns {Promise<{ status: number, headers: object, body: unknown }>}
 */
export function getJson(url, { headers = {}, approvedHosts = [], timeoutMs = 30_000, maxBodyBytes = 10_000_000 } = {}) {
  assertApprovedHost(url, approvedHosts);
  for (const [name, value] of [['timeoutMs', timeoutMs], ['maxBodyBytes', maxBodyBytes]]) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid ${name}: ${value} (expected a positive integer).`);
    }
  }
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (err) reject(err);
      else resolve(value);
    };
    const req = client.get(url, { headers }, (res) => {
      let data = '';
      let received = 0;
      res.setEncoding('utf8');
      res.on('error', (err) => finish(err));
      res.on('data', (chunk) => {
        received += Buffer.byteLength(chunk);
        if (received > maxBodyBytes) {
          res.destroy(new Error(`Response exceeded maxBodyBytes (${maxBodyBytes}).`));
          return;
        }
        data += chunk;
      });
      res.on('end', () => {
        let body = null;
        try {
          body = data ? JSON.parse(data) : null;
        } catch {
          body = data; // non-JSON payload — return raw text
        }
        finish(null, { status: res.statusCode, headers: res.headers, body });
      });
    });
    // Absolute deadline, not a socket-inactivity timeout: fires timeoutMs after the request
    // starts regardless of traffic, destroying the request (and any in-flight response).
    const deadline = setTimeout(() => {
      req.destroy(new Error(`Request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    req.on('error', (err) => finish(err));
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
