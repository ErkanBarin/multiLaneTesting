import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { scaffoldProject } from '../index.mjs';
import { runVerify } from '@multilane/core';

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

  // Authoring packages ride along as consumer devDependencies so `mlt authoring install`
  // resolves them after `npm ci` — the CLI itself does not bundle them.
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies['@multilane/authoring-web']);
  assert.ok(pkg.devDependencies['@multilane/authoring-http']);

  // The generated project must be green under the deterministic gates.
  const result = runVerify({ cwd: root });
  assert.equal(result.ok, true);
});

test('generated files carry no host/URL/secret literals', () => {
  const cwd = tmpWorkspace();
  const { root, files } = scaffoldProject({ name: 'demo', lanes: ['web', 'http', 'stomp', 'screen'], cwd });
  const forbidden = /(https?:\/\/[a-z0-9]|(?:\d{1,3}\.){3}\d{1,3}|_authToken=[A-Za-z0-9])/i;
  for (const rel of files) {
    if (rel.endsWith('.gitkeep')) continue;
    const body = readFileSync(join(root, rel), 'utf8');
    assert.equal(forbidden.test(body), false, `literal leaked in ${rel}`);
  }
});
