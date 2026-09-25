// A scaffolded project pins exact @multilane/* versions. If a pin names a version that is not the
// one the workspace publishes, every consumer's `npm ci` dies with ETARGET/404 — and no existing
// test noticed, because `dogfood.mjs` rewrites the deps to local `file:` tarballs before installing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject, SUPPORTED_LANES } from '../src/scaffold.mjs';

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Package name -> version, as the workspace actually publishes them. */
function workspaceVersions() {
  const out = new Map();
  for (const dir of readdirSync(packagesDir)) {
    try {
      const m = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'));
      out.set(m.name, m.version);
    } catch {
      // Not a package directory.
    }
  }
  return out;
}

test('every @multilane pin in a scaffolded project matches the workspace version', () => {
  const versions = workspaceVersions();
  const tmp = mkdtempSync(join(tmpdir(), 'mlt-scaffold-versions-'));
  try {
    // One project per lane, so a lane-specific package cannot slip through on an unused branch.
    for (const lane of SUPPORTED_LANES) {
      const { root } = scaffoldProject({ name: `demo-${lane}`, lanes: [lane], cwd: tmp });
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      for (const [dep, pinned] of Object.entries(pkg.devDependencies)) {
        if (!dep.startsWith('@multilane/')) continue;
        assert.equal(
          pinned,
          versions.get(dep),
          `lane "${lane}" pins ${dep}@${pinned}, but the workspace publishes ${versions.get(dep)}`,
        );
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
