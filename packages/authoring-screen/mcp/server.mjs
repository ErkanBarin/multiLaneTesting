#!/usr/bin/env node
// screen-driver MCP server: authoring-time tools for the screen lane.
//
// Stdio transport, newline-delimited JSON-RPC. It wraps the deterministic driver scripts shipped in
// @erkanbarin/screen so an authoring agent can explore a target and freeze locators. It is never
// part of a test run: it refuses to start unless SCREEN_DRIVER_MODE=authoring, and the no-runtime-AI
// gate forbids that setting anywhere a run can reach.
//
// What it returns to the model is text and file paths, never pixels: accessibility names, OCR words
// with their boxes, match coordinates. Screenshots stay on this machine (see the screen-exploration
// skill: no raw screen content to any external model). Every tool that touches the target refuses
// when SCREEN_RPS_PARTITION resolves to PROD.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const NAME = 'screen-driver';
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

if (process.env.SCREEN_DRIVER_MODE !== 'authoring') {
  process.stderr.write(
    `[${NAME}] Refusing to start: SCREEN_DRIVER_MODE must be set to "authoring" explicitly ` +
      `(got "${process.env.SCREEN_DRIVER_MODE ?? ''}").\n`,
  );
  process.exit(1);
}

// @erkanbarin/screen and @erkanbarin/core come from the consumer's own install; imported lazily so
// `health` can still say what is missing when they are not there.
const load = (name) => import(name);
let viewer = null;

async function drive(script, args) {
  const core = await load('@erkanbarin/core');
  core.assertTestPartition(core.loadConfig(process.env));
  const { runDriver } = await load('@erkanbarin/screen');
  return runDriver(script, args, { env: viewer?.env ?? process.env });
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
function checkName(label, value) {
  if (!SAFE_NAME.test(value ?? '')) throw new Error(`${label} must match ${SAFE_NAME} (got ${JSON.stringify(value)})`);
}

// Doctor reports, cut down to what an agent acts on: the verdicts, and every check that did not pass.
function summarize(report) {
  const verdicts = Object.fromEntries(Object.entries(report).filter(([k]) => k.startsWith('can_')));
  const problems = (report.checks ?? [])
    .filter((c) => c.status !== 'pass')
    .map(({ check, detail, hint }) => ({ check, detail, hint }));
  return { ...verdicts, problems };
}

const REGION = {
  type: 'array',
  items: { type: 'integer' },
  minItems: 4,
  maxItems: 4,
  description: '[x, y, width, height] in display pixels',
};
const ATSPI_COMMANDS = ['find_app', 'dump_tree', 'read', 'read_cell', 'read_sibling', 'table_dimensions',
  'extents', 'extents_cell', 'do_action'];
const FRAMEBUFFER_COMMANDS = ['find', 'ocr', 'compare', 'click', 'move', 'type', 'key'];

const TOOLS = {
  screen_driver_health: {
    description: 'Server status, the resolved test partition, the open viewer (if any), and what this host can and cannot do (both driver doctors, failing checks with the package to install).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      const report = { server: NAME, version: VERSION, mode: 'authoring', viewer: viewer && describeViewer() };
      try {
        const core = await load('@erkanbarin/core');
        report.partition = core.loadConfig(process.env).screen.partition;
        const { runDriver } = await load('@erkanbarin/screen');
        for (const [key, script] of [['atspi', 'atspiBridge'], ['framebuffer', 'framebuffer']]) {
          try {
            report[key] = summarize(runDriver(script, ['doctor'], { env: viewer?.env ?? process.env }));
          } catch (error) {
            report[key] = error.result?.checks ? summarize(error.result) : { error: error.message };
          }
        }
      } catch (error) {
        report.install = `@erkanbarin/screen@>=0.2.0 is not importable here: ${error.message}`;
      }
      return report;
    },
  },

  screen_driver_describe_authoring_flow: {
    description: 'The deterministic authoring flow: discover, freeze, human review, replay.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      return {
        flow: [
          '1) screen_driver_health — confirm the host, and that the partition is a test one.',
          '2) Remote target? screen_driver_open_viewer puts it on a local display first.',
          '3) Tier 1: screen_driver_atspi dump_tree/read to find a stable accessible name.',
          '4) No tree? Tier 2: screen_driver_framebuffer ocr to find where a control is, then screen_driver_capture_template to cut and verify a unique template.',
          '5) Resolve the candidate twice (screen_driver_framebuffer find / screen_driver_atspi read); both must agree.',
          '6) screen_driver_freeze_locator — dry run first, then write; a human reviews the diff.',
          '7) Specs replay the frozen locator with runDriver — no MCP and no model at runtime.',
        ],
        invariants: [
          'AI at authoring only, never at runtime.',
          'Test partitions only (TEST_A/TEST_B/TEST_C), never PROD.',
          'No host literals or secrets in committed artifacts.',
          'Pixels never leave this machine: tools return text and paths.',
        ],
      };
    },
  },

  screen_driver_list_channels: {
    description: 'The channel types used for discovery and runtime assertions, by tier.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      return {
        channels: [
          { name: 'object_socket', tier: 1, role: 'The target’s own object/state channel — the functional oracle.' },
          { name: 'atspi_tree', tier: 1, role: 'Accessibility tree (screen_driver_atspi).' },
          { name: 'template_match', tier: 2, role: 'Frozen template, stamped with DPI/resolution/theme (framebuffer find).' },
          { name: 'golden_image', tier: null, role: 'Rendering oracle (framebuffer compare).' },
          { name: 'offline_ocr', tier: null, role: 'Legibility oracle at runtime; locating text at authoring time (framebuffer ocr).' },
        ],
      };
    },
  },

  screen_driver_open_viewer: {
    description: 'Show the VNC/RDP target (SCREEN_TARGET_PROTOCOL, SCREEN_TARGET_HOST, SCREEN_GEOMETRY, credentials from SCREEN_TARGET_USER/SCREEN_TARGET_PASSWORD) full-screen on SCREEN_DISPLAY for this session. Every other tool then works on it.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      if (viewer) return { alreadyOpen: describeViewer() };
      const { openViewer } = await load('@erkanbarin/screen');
      viewer = await openViewer({ env: process.env });
      return describeViewer();
    },
  },

  screen_driver_close_viewer: {
    description: 'Close the viewer opened by screen_driver_open_viewer.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      if (!viewer) return { closed: false, reason: 'no viewer is open' };
      await viewer.close();
      viewer = null;
      return { closed: true };
    },
  },

  screen_driver_atspi: {
    description: 'Run a Tier-1 accessibility-tree command (atspi_bridge.py) and return its JSON. dump_tree is discovery; the rest are what a frozen Tier-1 locator replays.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: ATSPI_COMMANDS },
        args: { type: 'array', items: { type: 'string' }, description: 'app name, then the command’s own arguments' },
      },
      required: ['command'],
      additionalProperties: false,
    },
    run: ({ command, args = [] }) => drive('atspiBridge', [command, ...args]),
  },

  screen_driver_framebuffer: {
    description: 'Run a pixel command (framebuffer.py): find a template, OCR a region (words with boxes), compare against a golden, or click/move/type/key. Returns JSON, never an image.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: FRAMEBUFFER_COMMANDS },
        args: { type: 'array', items: { type: 'string' }, description: 'the command’s own arguments, e.g. ["--region","0","0","400","300"]' },
      },
      required: ['command'],
      additionalProperties: false,
    },
    run: ({ command, args = [] }) => drive('framebuffer', [command, ...args]),
  },

  screen_driver_capture_template: {
    description: 'Cut a Tier-2 template from the display into locators/<area>/<key>.png and prove it resolves uniquely right now. Returns the path and its resolver string, not the image.',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string' },
        key: { type: 'string' },
        region: REGION,
        overwrite: { type: 'boolean', description: 're-pin an existing template (supervised: review the diff)' },
      },
      required: ['area', 'key', 'region'],
      additionalProperties: false,
    },
    async run({ area, key, region, overwrite = false }) {
      checkName('area', area);
      checkName('key', key);
      const path = join('locators', area, `${key}.png`);
      if (existsSync(path) && !overwrite) throw new Error(`${path} exists; pass overwrite: true to re-pin it`);
      const shot = await drive('framebuffer', ['capture', path, '--region', ...region]);
      try {
        const verified = await drive('framebuffer', ['find', path]);
        return { ...shot, resolver: `template:${path}`, verified };
      } catch (error) {
        // An ambiguous template is useless as a locator; do not leave it behind to be frozen.
        rmSync(path, { force: true });
        throw new Error(`${error.message} — cut a region that contains something unique`);
      }
    },
  },

  screen_driver_freeze_locator: {
    description: 'Validate a frozen locator record and (with dry_run: false) write locators/<area>/<key>.json for human review. Tier 2 needs a template: resolver whose file exists and a stamp with the resolution.',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string' },
        key: { type: 'string' },
        tier: { type: 'integer', enum: [1, 2] },
        resolver: { type: 'string' },
        requirement_ref: { type: 'string', description: 'from the project’s traceability record — never invented' },
        stamp: {
          type: 'object',
          properties: { dpi: { type: 'number' }, resolution: { type: 'string' }, theme: { type: 'string' } },
          additionalProperties: false,
        },
        dry_run: { type: 'boolean', description: 'default true: validate and preview only' },
        overwrite: { type: 'boolean' },
      },
      required: ['area', 'key', 'tier', 'resolver', 'requirement_ref'],
      additionalProperties: false,
    },
    async run({ area, key, tier, resolver, requirement_ref, stamp, dry_run = true, overwrite = false }) {
      checkName('area', area);
      checkName('key', key);
      const record = { area, key, tier, resolver, ...(stamp && { stamp }), requirement_ref,
        last_verified: new Date().toISOString().slice(0, 10) };
      const { assertFrozen } = await load('@erkanbarin/screen');
      const { errors } = assertFrozen(record);
      if (tier === 2) {
        const template = resolver.startsWith('template:') ? resolver.slice('template:'.length) : null;
        if (!template) errors.push('a Tier-2 resolver is "template:<path to the png>"');
        else if (!existsSync(template)) errors.push(`template ${template} does not exist`);
        if (!stamp?.resolution) errors.push('a Tier-2 locator must be stamped with the resolution it was cut at');
      }
      if (errors.length) throw new Error(`not freezable: ${errors.join('; ')}`);
      const path = join('locators', area, `${key}.json`);
      if (dry_run) return { valid: true, path, record, note: 'Dry run: nothing written.' };
      if (existsSync(path) && !overwrite) throw new Error(`${path} exists; pass overwrite: true to re-pin it`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
      return { written: path, record, note: 'A frozen locator is a human decision: review the diff before committing.' };
    },
  },
};

function describeViewer() {
  const { display, protocol, width, height } = viewer;
  return { display, protocol, width, height };
}

// --- JSON-RPC over stdio -----------------------------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

async function handle(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg?.jsonrpc !== '2.0' || typeof msg.method !== 'string' || msg.id === undefined) return;
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return send({ id, result: { protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: false } },
      serverInfo: { name: NAME, version: VERSION } } });
  }
  if (method === 'tools/list') {
    return send({ id, result: { tools: Object.entries(TOOLS).map(([name, { description, inputSchema }]) =>
      ({ name, description, inputSchema })) } });
  }
  if (method !== 'tools/call') return send({ id, error: { code: -32601, message: `Method not found: ${method}` } });

  const tool = TOOLS[params?.name];
  if (!tool) return send({ id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
  try {
    const result = await tool.run(params.arguments ?? {});
    send({ id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
  } catch (error) {
    // A failed tool is an answer for the agent to read, not a protocol error.
    const detail = error.result ? `\n${JSON.stringify(error.result, null, 2)}` : '';
    send({ id, result: { isError: true, content: [{ type: 'text', text: `${error.message}${detail}` }] } });
  }
}

const input = createInterface({ input: process.stdin });
const inFlight = new Set();
input.on('line', (line) => {
  const call = handle(line.trim()).finally(() => inFlight.delete(call));
  inFlight.add(call);
});
input.on('close', async () => {
  // A client may send its last request and close stdin at once; answer it before leaving.
  await Promise.allSettled(inFlight);
  await viewer?.close();
  process.exit(0);
});
