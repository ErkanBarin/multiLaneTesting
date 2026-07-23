import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as web from '@multilane/authoring-web';
import * as http from '@multilane/authoring-http';
import * as stomp from '@multilane/authoring-stomp';

// Smoke: the PACKAGED authoring packages ship a readable lane manifest and their assets.
// Pure data, no side effects — authoring content never executes at test runtime.
const lanes = { web, http, stomp };

for (const [lane, mod] of Object.entries(lanes)) {
  test(`packaged @multilane/authoring-${lane} exposes its lane manifest`, () => {
    const manifest = mod.loadLaneManifest();
    assert.equal(manifest.lane, lane);
    assert.equal(manifest.runtimePackage, `@multilane/${lane}`);
    assert.equal(manifest.authoringPackage, `@multilane/authoring-${lane}`);
    assert.ok(Array.isArray(manifest.skills));
    assert.ok(existsSync(mod.laneManifestPath));
    assert.ok(existsSync(mod.assetsRoot));
  });
}
