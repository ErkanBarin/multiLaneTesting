// @multilane/authoring-http — HTTP-lane authoring assets.
//
// This package ships DEVELOPMENT-TIME content only: a lane manifest plus the source-of-truth
// skill/agent markdown under assets/. It has zero runtime dependencies and zero side effects at
// import time beyond reading its own manifest — nothing here executes a test, sends a request, or
// is imported by `@multilane/http`. The `mlt authoring` CLI is the only intended consumer: it
// resolves this package, reads the manifest, and materializes tool-specific files into a consumer
// project. Importing this module must never be required to run HTTP-lane tests.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Load this package's deterministic lane manifest (pure data, no side effects). */
export function loadLaneManifest() {
  return JSON.parse(readFileSync(join(HERE, 'lane.manifest.json'), 'utf8'));
}

export const laneManifestPath = join(HERE, 'lane.manifest.json');
export const assetsRoot = join(HERE, 'assets');
