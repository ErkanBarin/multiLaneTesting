// @multilane/screen — screen-driver lane (deterministic runtime surface).
//
// The runtime surface only ever LOADS and VALIDATES frozen locators — no discovery, no vision, no
// model. Locator discovery/freezing is an authoring-time concern handled elsewhere. Actuation
// (input synthesis, capture, the rendering and legibility oracles) lives in the argv-in/JSON-out
// scripts under driver/, reached through runDriver(); openViewer() brings a VNC/RDP target onto a
// local X display for them. This module is the deterministic contract the specs replay against.
//
// Safety-critical guard: every locator load asserts the resolved SCREEN_RPS_PARTITION is not the
// operational partition (PROD). This is a hard refusal baked into the runtime entry point itself —
// not a default a consumer could accidentally bypass by skipping `mlt verify`. See
// @multilane/core's `assertTestPartition` / `runScreenPartitionGate` for the CI-level mirror of
// this same guard.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig, assertTestPartition } from '@multilane/core';

/**
 * Load a frozen locator record from `locators/<area>/<key>.json`.
 * Refuses (throws) if SCREEN_RPS_PARTITION resolves to PROD — safety-critical, not configurable away.
 * @param {string} area
 * @param {string} key
 * @param {{ cwd?: string, locatorsDir?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {object} the frozen locator record
 */
export function loadFrozenLocator(
  area,
  key,
  { cwd = process.cwd(), locatorsDir = 'locators', env = process.env } = {},
) {
  assertTestPartition(loadConfig(env));
  const path = join(cwd, locatorsDir, area, `${key}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Validate a frozen locator: runtime replays Tier-1/2 only and requires a resolver + requirement_ref.
 * @param {object} locator
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertFrozen(locator) {
  const errors = [];
  if (!locator || typeof locator !== 'object') {
    return { ok: false, errors: ['locator is not an object'] };
  }
  if (![1, 2].includes(locator.tier)) {
    errors.push('tier must be 1 or 2 (runtime replays Tier-1/2 locators only)');
  }
  if (!locator.resolver) errors.push('resolver is required');
  if (!locator.requirement_ref) errors.push('requirement_ref is required');
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Actuation (Linux). The scripts under `driver/` speak argv-in / JSON-out, so a
// consumer in any language can spawn them; these helpers exist so nobody has to
// hardcode a path into node_modules.
// ---------------------------------------------------------------------------

const DRIVER_DIR = join(dirname(fileURLToPath(import.meta.url)), 'driver');

/** The driver scripts shipped with this package, by name. */
export const DRIVER_SCRIPTS = Object.freeze({
  /** Accessibility-tree reader: find_app/read/read_cell/extents/do_action/dump_tree. */
  atspiBridge: 'atspi_bridge.py',
  /** X11 context-menu stimulus for popups that expose no accessible tree. */
  menuActuate: 'menu_actuate.py',
  /** Pixels: capture, Tier-2 find, golden compare, OCR, click/move/type/key. */
  framebuffer: 'framebuffer.py',
});

/**
 * Absolute path to one of the `driver/` scripts.
 * @param {'atspiBridge' | 'menuActuate' | 'framebuffer'} name
 * @returns {string}
 */
export function driverScriptPath(name) {
  const file = DRIVER_SCRIPTS[name];
  if (!file) {
    throw new Error(
      `unknown driver script: ${name} (have ${Object.keys(DRIVER_SCRIPTS).join(', ')})`,
    );
  }
  return join(DRIVER_DIR, file);
}

/**
 * The interpreter to run the driver scripts with.
 *
 * The AT-SPI GObject-introspection binding (`gi`) is a *system* Python package, not something a
 * project venv carries. If the calling shell has an unrelated venv activated, a bare `python3` on
 * PATH resolves to that venv's interpreter and `import gi` fails with ModuleNotFoundError. Prefer
 * an explicit override, then the well-known system interpreter, and only fall back to PATH.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolvePythonBin(env = process.env) {
  if (env.SCREEN_ATSPI_PYTHON) return env.SCREEN_ATSPI_PYTHON;
  if (existsSync('/usr/bin/python3')) return '/usr/bin/python3';
  return 'python3';
}

/**
 * Run a driver script and return its JSON answer. Any non-zero exit throws an Error whose message
 * is the script's own `error`, with `exitCode` (1 not found / mismatch, 2 bad arguments, 3 host
 * cannot do it) and the parsed `result` attached — so a failed oracle fails the spec with the
 * evidence paths in the message.
 * @param {keyof typeof DRIVER_SCRIPTS} name
 * @param {Array<string | number>} args
 * @param {{ env?: Record<string, string | undefined>, cwd?: string }} [options]
 * @returns {any}
 */
export function runDriver(name, args, { env = process.env, cwd } = {}) {
  const script = driverScriptPath(name);
  const run = spawnSync(resolvePythonBin(env), [script, ...args.map(String)], {
    encoding: 'utf8',
    env,
    cwd,
  });
  const label = `${DRIVER_SCRIPTS[name]} ${args[0] ?? ''}`.trim();
  let result;
  try {
    result = JSON.parse(run.stdout);
  } catch {
    throw new Error(`${label} printed no JSON (exit ${run.status}): ${(run.stderr || String(run.error ?? '')).trim()}`);
  }
  if (run.status !== 0) {
    const error = new Error(`${label}: ${result.error ?? `exit ${run.status}`}`);
    Object.assign(error, { exitCode: run.status, result });
    throw error;
  }
  return result;
}

// ---------------------------------------------------------------------------
// VNC/RDP bridge. A remote screen-only target has no accessibility tree on this
// side of the wire, only pixels. openViewer() puts its desktop full-screen on a
// local X display, after which every framebuffer.py command works on it as if
// the target ran locally.
// ---------------------------------------------------------------------------

/**
 * The viewer command line for a protocol. Every flag here is load-bearing for determinism or for
 * running unattended; see README → "Screen-only targets over VNC/RDP".
 * @param {'vnc' | 'rdp'} protocol
 * @param {string} host  `host`, `host:display` or `host::port` (VNC); `host[:port]` (RDP)
 * @param {{ user?: string, program?: string, args?: string[] }} [options]
 * @returns {[string, string[]]}
 */
export function viewerCommand(protocol, host, { user, program, args = [] } = {}) {
  if (protocol === 'vnc') {
    return [
      program ?? 'vncviewer',
      [
        '-FullScreen', // the target's desktop at 0,0 of a display the same size
        '-RemoteResize=0', // never resize the target's desktop to fit this display
        '-NoJPEG', // lossless, or golden images and templates drift with compression
        '-Shared', // do not disconnect anyone else watching the target
        '-MenuKey=', // no F8 menu, and no "Press F8" notice painted over the first frames
        '-AlertOnFatalError=0', // exit on failure instead of waiting on a dialog nobody sees
        '-ReconnectOnError=0',
        ...args,
        host,
      ],
    ];
  }
  if (protocol === 'rdp') {
    if (!user) throw new Error('RDP needs a user: set SCREEN_TARGET_USER (DOMAIN\\user or user@domain).');
    return [
      program ?? 'xfreerdp',
      [
        `/v:${host}`,
        '/f', // the session takes this display's size, so the frame is 1:1 with no offset
        '/bpp:32',
        '-gfx', // the graphics pipeline codecs are lossy; plain bitmap updates are not
        '/cert:tofu', // accept the certificate on first connect, then pin it (no prompt)
        `/u:${user}`,
        '/from-stdin:force', // the password arrives on stdin, never on the command line
        '/log-level:WARN',
        ...args,
      ],
    ];
  }
  throw new Error(`unknown viewer protocol ${JSON.stringify(protocol)}: use "vnc" or "rdp"`);
}

/**
 * Show a VNC or RDP target full-screen on a local X display and wait until it is up.
 *
 * Refuses when SCREEN_RPS_PARTITION resolves to PROD, like loadFrozenLocator: connecting is the
 * first step of driving the target. Starts Xvfb on the display when nothing serves it, sized from
 * `geometry`, which must equal the target's desktop size for VNC (a smaller desktop is centred,
 * shifting every coordinate). Credentials come from SCREEN_TARGET_USER / SCREEN_TARGET_PASSWORD and
 * never reach a command line. Always `await viewer.close()` — typically in an `after()` hook.
 * @param {{ protocol?: 'vnc' | 'rdp', host?: string, display?: string, geometry?: string,
 *   args?: string[], timeoutMs?: number, env?: Record<string, string | undefined> }} [options]
 */
export async function openViewer(options = {}) {
  const env = options.env ?? process.env;
  const config = loadConfig(env);
  assertTestPartition(config);
  const protocol = options.protocol ?? env.SCREEN_TARGET_PROTOCOL;
  const host = options.host ?? config.screen.host;
  const display = options.display ?? config.screen.display;
  const geometry = options.geometry ?? env.SCREEN_GEOMETRY;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!host) throw new Error('SCREEN_TARGET_HOST is not set: there is no target to view.');
  if (geometry && !/^\d+x\d+$/.test(geometry)) {
    throw new Error(`SCREEN_GEOMETRY must look like 1920x1080, got ${JSON.stringify(geometry)}`);
  }

  const program =
    protocol === 'rdp' && !onPath('xfreerdp', env) && onPath('xfreerdp3', env) ? 'xfreerdp3' : undefined;
  const [bin, args] = viewerCommand(protocol, host, { user: env.SCREEN_TARGET_USER, program, args: options.args });
  const displayEnv = { ...env, DISPLAY: display };
  const deadline = Date.now() + timeoutMs;
  const socket = /^:\d+(\.\d+)?$/.test(display) && `/tmp/.X11-unix/X${display.slice(1).split('.')[0]}`;

  let xvfb, viewer;
  const stopAll = async () => {
    for (const child of [viewer, xvfb]) {
      if (!child || child.failed || child.exitCode !== null || child.signalCode !== null) continue;
      const exited = new Promise((done) => child.once('exit', () => done(true)));
      child.kill('SIGTERM');
      // Measured: a viewer whose connection is wedged can sit on SIGTERM indefinitely, and a
      // close() that never returns hangs the whole test run. Give it a grace period, then SIGKILL.
      if (!(await Promise.race([exited, delay(3000, false, { ref: false })]))) {
        child.kill('SIGKILL');
        await exited;
      }
    }
  };
  try {
    if (socket && !existsSync(socket)) {
      if (!geometry) throw new Error(`nothing serves ${display} and SCREEN_GEOMETRY is unset, so Xvfb cannot be sized.`);
      xvfb = watch(spawn('Xvfb', [display, '-screen', '0', `${geometry}x24`, '-nolisten', 'tcp'], { env }), 'Xvfb');
      while (!existsSync(socket)) await tick(xvfb, deadline, `Xvfb on ${display}`);
    }
    const root = rootSize(displayEnv);
    if (geometry && `${root.width}x${root.height}` !== geometry) {
      throw new Error(`${display} is ${root.width}x${root.height} but SCREEN_GEOMETRY is ${geometry}.`);
    }
    // Anything already full-screen on a shared display is not our viewer.
    const before = new Set(fullScreenWindows(displayEnv, root));
    const viewerEnv = { ...displayEnv };
    if (protocol === 'vnc') {
      // TigerVNC reads these itself; the password never appears in `ps`.
      if (env.SCREEN_TARGET_PASSWORD !== undefined) viewerEnv.VNC_PASSWORD = env.SCREEN_TARGET_PASSWORD;
      if (env.SCREEN_TARGET_USER !== undefined) viewerEnv.VNC_USERNAME = env.SCREEN_TARGET_USER;
    }
    viewer = watch(spawn(bin, args, { env: viewerEnv }), bin);
    viewer.stdin.on('error', () => {}); // a viewer that died at once must not crash us via EPIPE
    viewer.stdin.end(protocol === 'rdp' ? `${env.SCREEN_TARGET_PASSWORD ?? ''}\n` : '');
    while (!fullScreenWindows(displayEnv, root).some((id) => !before.has(id))) {
      await tick(viewer, deadline, `${bin} to show ${host} on ${display}`);
    }
    return {
      display,
      protocol,
      width: root.width,
      height: root.height,
      /** Pass to runDriver so its commands run against this display. */
      env: displayEnv,
      close: stopAll,
    };
  } catch (error) {
    await stopAll();
    throw error;
  }
}

function onPath(bin, env) {
  return (env.PATH ?? '').split(delimiter).some((dir) => dir && existsSync(join(dir, bin)));
}

/** Keep the tail of a child's output, so a failure can say why the viewer gave up. */
function watch(child, label) {
  child.log = '';
  const keep = (chunk) => (child.log = (child.log + chunk).slice(-2000));
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('error', (error) => {
    child.failed = true; // never started (e.g. not installed): there is no process to stop
    keep(`${label}: ${error.message}`);
  });
  return child;
}

// One poll step: fail fast if the child died, fail on the deadline, otherwise wait briefly.
async function tick(child, deadline, what) {
  if (child.failed || child.exitCode !== null || child.signalCode !== null) {
    throw new Error(`gave up waiting for ${what}: it exited.\n${child.log.trim()}`);
  }
  if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}.\n${child.log.trim()}`);
  await delay(100);
}

function xwininfo(args, env) {
  const run = spawnSync('xwininfo', args, { encoding: 'utf8', env });
  if (run.error) throw new Error(`xwininfo is required to open a viewer: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`xwininfo ${args.join(' ')} failed: ${run.stderr.trim()}`);
  return run.stdout;
}

function rootSize(env) {
  const out = xwininfo(['-root'], env);
  const field = (name) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(out)?.[1]);
  return { width: field('Width'), height: field('Height') };
}

// Ids of top-level windows covering the whole display at 0,0 — what a full-screen viewer maps.
function fullScreenWindows(env, { width, height }) {
  const size = ` ${width}x${height}+0+0 `;
  return xwininfo(['-root', '-children'], env)
    .split('\n')
    .filter((line) => line.includes(size))
    .map((line) => line.trim().split(/\s/)[0]);
}
