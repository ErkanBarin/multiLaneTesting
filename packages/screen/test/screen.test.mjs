import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { driverScriptPath, openViewer, resolvePythonBin, runDriver, viewerCommand } from '../index.mjs';

const python = resolvePythonBin();
const noPython = spawnSync(python, ['--version']).status === 0 ? false : `${python} is not runnable`;

test('the VNC command line keeps the picture lossless, 1:1 and unattended', () => {
  const [bin, args] = viewerCommand('vnc', 'target::5901');
  assert.equal(bin, 'vncviewer');
  for (const flag of ['-FullScreen', '-RemoteResize=0', '-NoJPEG', '-MenuKey=', '-AlertOnFatalError=0']) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
  assert.equal(args.at(-1), 'target::5901', 'the host goes last, after any extra args');
});

test('the RDP command line never carries the password', () => {
  assert.throws(() => viewerCommand('rdp', 'target'), /SCREEN_TARGET_USER/);
  const [bin, args] = viewerCommand('rdp', 'target:3389', { user: 'DOM\\tester', program: 'xfreerdp3' });
  assert.equal(bin, 'xfreerdp3');
  assert.ok(args.includes('/from-stdin:force'));
  assert.ok(args.includes('/u:DOM\\tester'));
  assert.equal(args.some((a) => a.startsWith('/p:')), false);
  assert.throws(() => viewerCommand('spice', 'target'), /unknown viewer protocol/);
});

test('openViewer refuses the operational partition before touching anything', async () => {
  // No viewer or Xvfb is installed-or-needed for this: the refusal comes first.
  const env = { SCREEN_RPS_PARTITION: 'PROD', SCREEN_TARGET_HOST: 'target', SCREEN_TARGET_PROTOCOL: 'vnc' };
  await assert.rejects(openViewer({ env }), /PROD/);
  await assert.rejects(openViewer({ env: { SCREEN_TARGET_PROTOCOL: 'vnc' } }), /SCREEN_TARGET_HOST/);
  await assert.rejects(
    openViewer({ env: { SCREEN_TARGET_HOST: 'target', SCREEN_GEOMETRY: '1920*1080' } }),
    /SCREEN_GEOMETRY/,
  );
});

test('runDriver turns a failing command into an error carrying its exit code', { skip: noPython }, () => {
  assert.throws(
    () => runDriver('framebuffer', ['find']),
    (error) => error.exitCode === 2 && /framebuffer\.py find/.test(error.message),
  );
});

test('the Python driver self-checks pass', { skip: noPython }, () => {
  const run = spawnSync(python, [driverScriptPath('framebuffer').replace('framebuffer.py', 'test_driver.py')], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

// A real round trip over VNC: an Xvnc "target" showing a dialog, the viewer on its own Xvfb, and
// the dialog's own answer as functional truth. Needs Xvnc, zenity, vncviewer, Xvfb and xwininfo,
// so it runs only when asked; a skip here still exits 0, hence the reason is spelled out.
const e2e =
  process.env.MULTILANE_SCREEN_E2E === '1' ? false : 'set MULTILANE_SCREEN_E2E=1 to run the live VNC round trip';

test('a VNC target can be viewed, compared, typed into and read back', { skip: e2e }, async (t) => {
  const { spawn } = await import('node:child_process');
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { setTimeout: delay } = await import('node:timers/promises');

  const [targetDisplay, viewerDisplay, port] = [':171', ':172', '5971'];
  for (const d of [targetDisplay, viewerDisplay]) {
    assert.equal(existsSync(`/tmp/.X11-unix/X${d.slice(1)}`), false, `display ${d} is already taken`);
  }
  const target = spawn('Xvnc', [targetDisplay, '-geometry', '800x600', '-depth', '24', '-SecurityTypes',
    'None', '-rfbport', port, '-localhost', '-nolisten', 'tcp']);
  t.after(() => target.kill());
  while (!existsSync(`/tmp/.X11-unix/X${targetDisplay.slice(1)}`)) await delay(100);
  const dialog = spawn('zenity', ['--entry', '--title=Probe', '--text=Callsign', '--entry-text=ABC123'], {
    env: { ...process.env, DISPLAY: targetDisplay },
  });
  let answer = '';
  dialog.stdout.on('data', (chunk) => (answer += chunk));
  const answered = new Promise((done) => dialog.once('exit', done));
  t.after(() => dialog.kill());

  const env = {
    ...process.env,
    SCREEN_TARGET_HOST: `localhost::${port}`,
    SCREEN_TARGET_PROTOCOL: 'vnc',
    SCREEN_DISPLAY: viewerDisplay,
    SCREEN_GEOMETRY: '800x600',
    SCREEN_RPS_PARTITION: 'TEST_A',
  };
  const viewer = await openViewer({ env });
  t.after(() => viewer.close());
  assert.deepEqual([viewer.width, viewer.height], [800, 600]);

  const dir = mkdtempSync(join(tmpdir(), 'mlt-screen-'));
  const golden = join(dir, 'target.png');
  // The reference is the target's own picture, taken once the dialog is mapped and two captures in
  // a row agree -- i.e. it has finished drawing.
  const targetEnv = { ...process.env, DISPLAY: targetDisplay };
  const mapped = () =>
    /IsViewable/.test(spawnSync('xwininfo', ['-name', 'Probe'], { encoding: 'utf8', env: targetEnv }).stdout);
  for (let i = 0; i < 100 && !mapped(); i++) await delay(100);
  for (let settled = false, i = 0; !settled; i++) {
    assert.ok(i < 50, 'the target never stopped changing');
    runDriver('framebuffer', ['capture', golden], { env: targetEnv });
    await delay(200);
    try {
      settled = runDriver('framebuffer', ['compare', golden, '--out', dir], { env: targetEnv }).match;
    } catch {
      settled = false;
    }
  }

  // 1:1 frame: the viewer's picture equals the target's, except for the pointer it draws (<0.1%).
  // A centred or shifted frame differs in thousands of pixels and fails here.
  const same = runDriver('framebuffer', ['compare', golden, '--max-diff-ratio', '0.001', '--out', dir], {
    env: viewer.env,
  });
  assert.equal(same.match, true, JSON.stringify(same));
  const found = runDriver('framebuffer', ['find', golden, '--timeout', '5'], { env: viewer.env });
  assert.deepEqual([found.x, found.y], [0, 0]);

  // Input through the viewer. The pointer starts over the centred dialog, which has focus there.
  runDriver('framebuffer', ['key', 'ctrl+a'], { env: viewer.env });
  runDriver('framebuffer', ['type', 'Xyz-789_Q'], { env: viewer.env });
  const ocr = runDriver('framebuffer', ['doctor'], { env: viewer.env }).can_ocr;
  if (ocr) {
    await delay(500);
    const read = runDriver('framebuffer', ['ocr'], { env: viewer.env });
    assert.match(read.text, /Xyz-789_Q/);
  } else {
    t.diagnostic('tesseract is not installed: the OCR step was not run');
  }
  runDriver('framebuffer', ['key', 'Return'], { env: viewer.env });
  await answered;
  // Functional truth: the dialog itself reports what it received.
  assert.equal(answer.trim(), 'Xyz-789_Q');
});
