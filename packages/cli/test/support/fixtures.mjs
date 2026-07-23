// @multilane/cli — shared fixture helpers for authoring lane tests.
//
// Generic across lanes: copies a real authoring package's directory into a fixture project's
// node_modules, proving standard Node resolution — no engine checkout needed by the fixture.
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tmpFixture(prefix = 'mlt-authoring-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFixtureProject(root, { lanes = [] } = {}) {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture-project', version: '0.0.0' }, null, 2));
  if (lanes.length) {
    writeFileSync(join(root, 'multilane.config.json'), JSON.stringify({ lanes }, null, 2));
  }
}

/**
 * Copy a real `@multilane/authoring-<lane>` package directory into the fixture's node_modules.
 * @param {string} root  fixture project root
 * @param {string} shortName  e.g. "http", "stomp", "web"
 * @param {string} realPkgDir  absolute path to the real package directory
 */
export function installFixtureAuthoringPackage(root, shortName, realPkgDir) {
  const target = join(root, 'node_modules', '@multilane', `authoring-${shortName}`);
  mkdirSync(join(root, 'node_modules', '@multilane'), { recursive: true });
  cpSync(realPkgDir, target, { recursive: true });
  return target;
}
