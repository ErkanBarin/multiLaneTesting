// @multilane/core — Robot @tag contract gate.
//
// Keeps the @tag contract consistent across the places this repo controls:
//   (1) spec titles under the spec dir      — the @tag the runner filters on
//   (2) the tags allowlist (project config) — the guard's source of truth
//   (3) the robot-orchestration contract doc — the human-readable contract
//
// Extracted from scripts/check-robot-contract.mjs so the engine and `mlt verify` share it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { DEFAULT_SPEC_DIR, DEFAULT_CONTRACT_DOC } from '../config.mjs';

const TAG_RE = /@[a-zA-Z][a-zA-Z0-9]+/g;
const SPEC_EXT = new Set(['.ts', '.js', '.py']);

/**
 * Check @tag consistency between specs, the allowlist, and the contract doc.
 * @returns {{ ok: boolean, specTags: string[], errors: string[] }}
 */
export function runRobotContractGate({
  cwd = process.cwd(),
  specDir = DEFAULT_SPEC_DIR,
  contractDoc = DEFAULT_CONTRACT_DOC,
  tags = [],
} = {}) {
  const specTags = new Set();

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) walk(path);
      else if (SPEC_EXT.has(extname(name))) {
        const src = readFileSync(path, 'utf8');
        for (const line of src.split('\n')) {
          if (/\b(test|it|scenario)\s*\(/.test(line)) {
            for (const m of line.match(TAG_RE) ?? []) specTags.add(m);
          }
        }
      }
    }
  }

  walk(join(cwd, specDir));

  let doc = '';
  try {
    doc = readFileSync(join(cwd, contractDoc), 'utf8');
  } catch {
    // Contract doc optional in a fresh consumer project.
  }

  const errors = [];
  for (const t of specTags) {
    if (!tags.includes(t)) errors.push(`spec tag ${t} is not in the tags allowlist`);
    if (doc && !doc.includes(t)) errors.push(`spec tag ${t} is missing from ${contractDoc}`);
  }
  for (const t of tags) {
    if (![...specTags].includes(t)) errors.push(`allowlisted tag ${t} is used by no spec`);
  }

  return { ok: errors.length === 0, specTags: [...specTags], errors };
}

/**
 * Print the robot-contract result and return whether it passed.
 * @returns {boolean}
 */
export function reportRobotContract(result) {
  if (!result.ok) {
    console.error('✖ robot-contract guard FAILED:');
    for (const e of result.errors) console.error(`  ${e}`);
    return false;
  }
  console.log(`✓ robot-contract guard passed — ${result.specTags.length} spec tag(s) consistent.`);
  return true;
}
