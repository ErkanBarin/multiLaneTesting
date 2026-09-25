import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../mcp/server.mjs', import.meta.url));

// One server per test; `call` sends a request and resolves with the response carrying its id.
function start(env = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'mlt-mcp-'));
  const child = spawn(process.execPath, [SERVER], {
    cwd,
    env: { ...process.env, SCREEN_DRIVER_MODE: 'authoring', SCREEN_RPS_PARTITION: 'TEST_A', ...env },
  });
  const waiting = new Map();
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const msg = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  let next = 0;
  const call = (method, params) =>
    new Promise((done) => {
      const id = ++next;
      waiting.set(id, done);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  const tool = async (name, args = {}) => (await call('tools/call', { name, arguments: args })).result;
  return { cwd, call, tool, stop: () => child.stdin.end() };
}

test('refuses to start outside authoring mode', () => {
  const run = spawnSync(process.execPath, [SERVER], { env: { ...process.env, SCREEN_DRIVER_MODE: '' }, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /SCREEN_DRIVER_MODE must be set to "authoring"/);
});

test('answers a request that arrives together with the end of its input', () => {
  // A client that writes its last request and closes stdin at once must still get the answer.
  const request = { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'screen_driver_health', arguments: {} } };
  const run = spawnSync(process.execPath, [SERVER], {
    input: `${JSON.stringify(request)}\n`,
    env: { ...process.env, SCREEN_DRIVER_MODE: 'authoring' },
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout.trim().split('\n').at(-1)).id, 7);
});

test('lists portable tool names and answers health on any host', async (t) => {
  const server = start();
  t.after(server.stop);
  const init = await server.call('initialize', {});
  assert.equal(init.result.serverInfo.name, 'screen-driver');
  const { tools } = (await server.call('tools/list')).result;
  // Dots are not portable across MCP clients; every name is a plain identifier.
  for (const { name } of tools) assert.match(name, /^[a-z_]+$/);
  for (const name of ['screen_driver_health', 'screen_driver_atspi', 'screen_driver_framebuffer',
    'screen_driver_open_viewer', 'screen_driver_capture_template', 'screen_driver_freeze_locator']) {
    assert.ok(tools.some((tool) => tool.name === name), `missing ${name}`);
  }
  const health = JSON.parse((await server.tool('screen_driver_health')).content[0].text);
  assert.equal(health.partition, 'TEST_A');
  // Whatever this host has, both doctors answer with verdicts rather than crashing the server.
  assert.equal(typeof health.framebuffer.can_capture, 'boolean', JSON.stringify(health.framebuffer));
  assert.equal(typeof health.atspi.can_read, 'boolean', JSON.stringify(health.atspi));
});

test('freeze_locator previews, writes once, and refuses what cannot be replayed', async (t) => {
  const server = start();
  t.after(server.stop);
  const record = { area: 'dialog', key: 'title', tier: 1, resolver: 'atspi:MyApp/Title', requirement_ref: 'REQ_1' };
  const path = join(server.cwd, 'locators/dialog/title.json');

  const preview = await server.tool('screen_driver_freeze_locator', record);
  assert.equal(preview.isError, undefined, preview.content[0].text);
  assert.equal(existsSync(path), false, 'a dry run must write nothing');

  const written = await server.tool('screen_driver_freeze_locator', { ...record, dry_run: false });
  assert.equal(written.isError, undefined, written.content[0].text);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).requirement_ref, 'REQ_1');
  const again = await server.tool('screen_driver_freeze_locator', { ...record, dry_run: false });
  assert.equal(again.isError, true);
  assert.match(again.content[0].text, /exists/);

  const tier2 = await server.tool('screen_driver_freeze_locator', { ...record, tier: 2, resolver: 'template:nope.png' });
  assert.equal(tier2.isError, true);
  assert.match(tier2.content[0].text, /does not exist/);
  assert.match(tier2.content[0].text, /stamped with the resolution/);

  const escape = await server.tool('screen_driver_freeze_locator', { ...record, area: '../outside' });
  assert.equal(escape.isError, true, 'an area must not reach outside locators/');
});

test('every tool that reaches the target refuses the operational partition', async (t) => {
  const server = start({ SCREEN_RPS_PARTITION: 'PROD' });
  t.after(server.stop);
  for (const [name, args] of [
    ['screen_driver_atspi', { command: 'find_app', args: ['MyApp'] }],
    ['screen_driver_framebuffer', { command: 'click', args: ['1', '1'] }],
    ['screen_driver_capture_template', { area: 'a', key: 'b', region: [0, 0, 1, 1] }],
    ['screen_driver_open_viewer', {}],
  ]) {
    const result = await server.tool(name, args);
    assert.equal(result.isError, true, name);
    assert.match(result.content[0].text, /PROD/, name);
  }
});
