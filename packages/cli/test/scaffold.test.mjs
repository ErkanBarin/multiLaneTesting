import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { scaffoldProject, SUPPORTED_LANES } from '../index.mjs';
import { runVerify } from '@erkanbarin/core';

function tmpWorkspace() {
  return mkdtempSync(join(tmpdir(), 'mlt-cli-'));
}

test('scaffoldProject rejects invalid names and empty lanes', () => {
  const cwd = tmpWorkspace();
  assert.throws(() => scaffoldProject({ name: 'Bad Name', lanes: ['web'], cwd }), /Invalid project name/);
  assert.throws(() => scaffoldProject({ name: 'demo', lanes: [], cwd }), /at least one lane/);
  assert.throws(() => scaffoldProject({ name: 'demo', lanes: ['nope'], cwd }), /Unknown lane/);
});

test('scaffolded web+http project passes mlt verify', () => {
  const cwd = tmpWorkspace();
  const { root, files } = scaffoldProject({ name: 'demo', lanes: ['web', 'http'], cwd });

  assert.ok(existsSync(join(root, 'package.json')));
  assert.ok(files.includes('tests/web/example.web.spec.ts'));
  assert.ok(files.includes('tests/http/example.http.test.mjs'));
  assert.ok(files.includes('.npmrc'));
  assert.ok(files.includes('Jenkinsfile'));

  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /^npm install$/m);
  assert.match(readme, /node <engine-repo>\/scripts\/install-tarballs\.mjs \./);
  assert.doesNotMatch(readme, /npm ci|npm test/);

  // The generated project must be green under the deterministic gates.
  const result = runVerify({ cwd: root });
  assert.equal(result.ok, true);
});

test('new and create-system print the registry install command and the tarball alternative', () => {
  for (const command of ['new', 'create-system']) {
    const output = execFileSync(process.execPath, [fileURLToPath(new URL('../bin/mlt.mjs', import.meta.url)), command, 'demo', '--lanes', 'web'], {
      cwd: tmpWorkspace(),
      encoding: 'utf8',
    });
    assert.match(output, /Next: cd demo && npm install && npm run verify/);
    assert.match(output, /node <engine-repo>\/scripts\/install-tarballs\.mjs \./);
  }
});

test('generated .npmrc overrides neither the scope mapping nor auth', () => {
  const cwd = tmpWorkspace();
  const { root } = scaffoldProject({ name: 'demo', lanes: ['web'], cwd });
  const active = readFileSync(join(root, '.npmrc'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'));

  // Every line this file once emitted broke an install. A project-level scope mapping overrode the
  // user-level one and, with its variable unexported, failed with ERR_INVALID_URL; _authToken hit a
  // disabled Bearer realm (E401), an empty expansion sent a blank header (E503), and a global
  // always-auth leaked the credential to every other registry. Keep them all commented out.
  assert.deepEqual(active, [], `generated .npmrc must stay comments only:\n${active.join('\n')}`);
});

test('generated files carry no host/URL/secret literals', () => {
  const cwd = tmpWorkspace();
  // Every lane, so a lane added later cannot leak a literal that no test looks at.
  const { root, files } = scaffoldProject({ name: 'demo', lanes: SUPPORTED_LANES, cwd });
  // The IPv4 arm excludes two things that look like addresses but are not target hosts:
  //   127.x  — loopback, the deliberate containment default for the emulator and trap listener
  //   (?!\.\d) — an OID has more than four dotted components, so 1.3.6.1.4.1 is not an address
  // Both are required by the snmp/trap lanes; widening the regex instead would blind it to real
  // addresses, and exempting those files would blind it to everything else they contain.
  const forbidden = /(https?:\/\/[a-z0-9]|\b(?!127\.)(?:\d{1,3}\.){3}\d{1,3}\b(?!\.\d)|_authToken=[A-Za-z0-9])/i;
  for (const rel of files) {
    if (rel.endsWith('.gitkeep')) continue;
    const body = readFileSync(join(root, rel), 'utf8');
    assert.equal(forbidden.test(body), false, `literal leaked in ${rel}`);
  }
  // The narrowing above must not have disarmed the check it exists to perform.
  assert.ok(forbidden.test('host=10.20.30.40'), 'a real IPv4 literal must still be caught');
  assert.equal(forbidden.test("oid: '1.3.6.1.4.1.99999.1.0'"), false);
});

test('scaffolded snmp+trap project passes mlt verify and wires both halves of the runtime', () => {
  const cwd = tmpWorkspace();
  const { root, files } = scaffoldProject({ name: 'demo', lanes: ['snmp', 'trap'], cwd });

  assert.ok(files.includes('tests/snmp/example.snmp.test.mjs'));
  assert.ok(files.includes('tests/trap/example.trap.test.mjs'));
  // Both lanes share one example model; selecting both must not emit it twice or disagree on it.
  assert.equal(files.filter((f) => f === 'models/example.agent.json').length, 1);

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['test:snmp'] !== undefined, true);
  assert.equal(pkg.scripts['test:trap'] !== undefined, true);
  assert.ok(pkg.devDependencies['@erkanbarin/snmp-runtime'], 'trap and snmp both need the runtime');
  assert.ok(pkg.devDependencies['net-snmp'], 'net-snmp is the transport, not an optional extra');

  assert.equal(runVerify({ cwd: root }).ok, true);
});

test('every supported lane scaffolds at least one spec', () => {
  // `laneFiles` falls through to `return []` for an unknown lane, so a lane added to
  // SUPPORTED_LANES without its files scaffolds a project with nothing in it and still exits 0.
  for (const lane of SUPPORTED_LANES) {
    const { files } = scaffoldProject({ name: 'demo', lanes: [lane], cwd: tmpWorkspace() });
    assert.ok(
      files.some((f) => f.startsWith(`tests/${lane}/`)),
      `lane "${lane}" is selectable but scaffolds no spec under tests/${lane}/`,
    );
  }
});
