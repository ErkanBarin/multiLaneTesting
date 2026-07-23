// @multilane/cli — authoring provenance store.
//
// A single deterministic file per consumer project records exactly what `mlt authoring install`
// wrote, so `mlt authoring check` can detect drift later. No timestamp field: unchanged
// reinstallation must stay byte-identical (see LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md,
// "Provenance and integrity").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const PROVENANCE_SCHEMA_VERSION = 1;
export const PROVENANCE_PATH = join('.multilane', 'authoring.lock.json');

export function readProvenance(cwd = process.cwd()) {
  const path = join(cwd, PROVENANCE_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeProvenance(cwd, provenance) {
  const path = join(cwd, PROVENANCE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  // Stable key order + trailing newline so byte-identical reinstalls produce an identical file.
  writeFileSync(path, `${JSON.stringify(sortDeep(provenance), null, 2)}\n`);
}

export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortDeep(value[k])]));
  }
  return value;
}
