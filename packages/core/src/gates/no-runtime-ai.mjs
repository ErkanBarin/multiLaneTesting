// @erkanbarin/core — no-runtime-AI gate.
//
// The core invariant of multilanetesting: AI runs at AUTHORING time, never at RUNTIME. This gate
// fails if any runtime path (drivers/, tests/, web/api/ws lanes) imports a vision / computer-use /
// discovery module. Authoring-only code lives under authoring/ (and drivers/mcp) and is exempt.
//
// Extracted from scripts/check-no-runtime-ai.mjs so the engine, the `mlt verify` CLI, and consumer
// projects all run the same implementation.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { DEFAULT_RUNTIME_DIRS, DEFAULT_AUTHORING_DIRS } from '../config.mjs';

// Forbidden at runtime: keep in sync with pyproject [tool.multilanetesting].runtime_forbidden_imports.
export const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bfrom\s+['"]?anthropic/i,
  /\bimport\s+anthropic/i,
  /\bfrom\s+['"]?openai/i,
  /\bimport\s+openai/i,
  /@anthropic-ai\//i,
  /\brequire\s*\(\s*['"](?:anthropic|openai|@anthropic-ai)/i,
  /\bomniparser\b/i,
  /\bpaddleocr\b/i,
  /\beasyocr\b/i,
  /computer[_-]?use/i,
  /SCREEN_DRIVER_MODE\s*=\s*['"]authoring['"]/i,
];

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py']);

// A file carrying this marker is skipped and listed in the report. It exists for the handful of
// files that must contain a forbidden string to do their job — this pattern list, its tests, and
// docs describing the ban — and for nothing else. Exemptions are never silent: `reportNoRuntimeAi`
// prints every skipped path, so `grep -rn 'no-runtime-ai:allow'` and the gate output agree.
// This file self-exempts by containing the literal below, which is correct: it IS the pattern list.
export const ALLOW_MARKER = 'no-runtime-ai:allow';

/**
 * Scan runtime trees for forbidden model usage.
 * @returns {{ ok: boolean, scanned: number, exempt: string[], violations: Array<{ path: string, pattern: string }> }}
 */
export function runNoRuntimeAiGate({
  cwd = process.cwd(),
  runtimeDirs = DEFAULT_RUNTIME_DIRS,
  authoringDirs = DEFAULT_AUTHORING_DIRS,
  forbidden = FORBIDDEN_RUNTIME_PATTERNS,
} = {}) {
  const violations = [];
  const exempt = [];
  let scanned = 0;

  const isAuthoring = (rel) =>
    authoringDirs.some((a) => rel === a || rel.startsWith(a + '/') || rel.includes('/' + a + '/'));

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return; // tree not present yet — fine
    }
    for (const name of entries) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.venv') continue;
        walk(path);
      } else if (CODE_EXT.has(extname(name))) {
        const rel = relative(cwd, path);
        if (isAuthoring(rel)) continue;
        const src = readFileSync(path, 'utf8');
        if (src.includes(ALLOW_MARKER)) {
          exempt.push(rel);
          continue;
        }
        scanned++;
        for (const re of forbidden) {
          if (re.test(src)) violations.push({ path: rel, pattern: re.source });
        }
      }
    }
  }

  for (const d of runtimeDirs) walk(join(cwd, d));

  return { ok: violations.length === 0, scanned, exempt, violations };
}

/**
 * Print the no-runtime-AI result in the classic format and return whether it passed.
 * @returns {boolean}
 */
export function reportNoRuntimeAi(result) {
  if (!result.ok) {
    console.error('✖ no-runtime-ai guard FAILED — model usage reachable from a runtime path:');
    for (const v of result.violations) console.error(`  ${v.path}  (matched /${v.pattern}/)`);
    console.error('\nMove this code under authoring/ or remove the model dependency from the run path.');
    return false;
  }
  if (result.scanned === 0) {
    console.warn('⚠ no-runtime-ai guard: PASS is vacuous — 0 runtime files scanned (no runtime code exists yet).');
  } else {
    console.log(`✓ no-runtime-ai guard passed — ${result.scanned} runtime file(s) scanned, no model usage reachable.`);
  }
  // Exemptions are reported on a pass too: an unread allow-marker is how this gate goes hollow.
  for (const path of result.exempt ?? []) console.log(`  exempt (${ALLOW_MARKER}): ${path}`);
  return true;
}
