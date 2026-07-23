// @multilane/cli — `mlt authoring check`.
//
// Detects drift between what was installed (recorded in the provenance file) and what is actually
// on disk / currently resolvable. A digest mismatch means the file changed since install — it does
// NOT authenticate who published the source package. Supply-chain trust for the package itself
// comes from npm package integrity + registry access controls, not this digest.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AUTHORING_LANE_PACKAGES } from './registry.mjs';
import { resolveAuthoringPackage } from './resolve.mjs';
import { digestContent } from './digest.mjs';
import { readProvenance, PROVENANCE_PATH } from './provenance.mjs';
import { loadProjectConfig } from '@multilane/core';

/**
 * @returns {{ ok: boolean, issues: Array<{ lane: string|null, type: string, detail: string }> }}
 */
export function checkAuthoring({ cwd = process.cwd() } = {}) {
  const issues = [];
  const provenance = readProvenance(cwd);

  if (!provenance) {
    // readProvenance returns null both when the file is absent and when it exists but is not valid
    // JSON — an edited/corrupted lock file must surface as its own condition, not as "never installed".
    const malformed = existsSync(join(cwd, PROVENANCE_PATH));
    return {
      ok: false,
      issues: [
        malformed
          ? { lane: null, type: 'malformed-provenance', detail: `${PROVENANCE_PATH} exists but could not be parsed — restore it from version control or re-run "mlt authoring install".` }
          : { lane: null, type: 'missing-provenance', detail: `No ${PROVENANCE_PATH} found — run "mlt authoring install" first.` },
      ],
    };
  }

  // Built once, globally: several lanes can materialize into the same shared directory (e.g.
  // `.github/prompts/`), so "is this file known" must be checked against every lane's targets, not
  // just the one asset currently being examined — otherwise lane B's legitimate file reads as an
  // "extra" file while checking lane A's directory, and vice versa.
  const allKnownPaths = new Set();
  const allTargetDirs = new Set();
  for (const record of Object.values(provenance.lanes ?? {})) {
    for (const asset of record.assets ?? []) {
      for (const target of asset.targets ?? []) {
        const abs = join(cwd, target.path);
        allKnownPaths.add(abs);
        allTargetDirs.add(dirname(abs));
      }
    }
  }

  for (const [lane, record] of Object.entries(provenance.lanes ?? {})) {
    const pkgName = AUTHORING_LANE_PACKAGES[lane] ?? record.authoringPackage;
    const resolved = resolveAuthoringPackage(pkgName, { cwd });
    if (!resolved) {
      issues.push({ lane, type: 'unresolvable-package', detail: `"${pkgName}" is no longer resolvable from ${cwd}.` });
    } else {
      if (resolved.pkg.version !== record.authoringVersion) {
        issues.push({
          lane,
          type: 'package-version-drift',
          detail: `Installed provenance records ${record.authoringVersion}, resolved package is now ${resolved.pkg.version}. Run "mlt authoring update".`,
        });
      }
    }

    for (const asset of record.assets ?? []) {
      if (asset.status === 'not-enabled') continue;

      if (resolved) {
        const sourcePath = join(resolved.dir, asset.sourcePath);
        if (existsSync(sourcePath)) {
          const currentSourceDigest = digestContent(readFileSync(sourcePath, 'utf8'));
          if (currentSourceDigest !== asset.sourceDigest) {
            issues.push({
              lane,
              type: 'stale-wrapper',
              detail: `Source for "${asset.id}" changed since install (${asset.sourcePath}). Run "mlt authoring update".`,
            });
          }
        }
      }

      for (const target of asset.targets ?? []) {
        const abs = join(cwd, target.path);
        if (!existsSync(abs)) {
          issues.push({ lane, type: 'deleted-file', detail: `${target.path} (asset "${asset.id}") is missing.` });
          continue;
        }
        const currentDigest = digestContent(readFileSync(abs, 'utf8'));
        if (currentDigest !== target.digest) {
          issues.push({ lane, type: 'modified-file', detail: `${target.path} (asset "${asset.id}") was modified after install.` });
        }
      }

      const presentCount = (asset.targets ?? []).filter((t) => existsSync(join(cwd, t.path))).length;
      if (presentCount > 0 && presentCount < (asset.targets ?? []).length) {
        issues.push({ lane, type: 'partial-installation', detail: `Asset "${asset.id}" is only partially installed (${presentCount}/${asset.targets.length} files present).` });
      }
    }
  }

  // Extra-file scan runs once, globally, across every directory any asset (any lane) wrote into —
  // see allKnownPaths/allTargetDirs above. Not attributable to a single lane when shared.
  for (const dir of allTargetDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) continue;
      if (!allKnownPaths.has(abs)) {
        issues.push({ lane: null, type: 'extra-file', detail: `Unexpected extra file in a managed asset directory: ${abs}.` });
      }
    }
  }

  const projectConfig = loadProjectConfig(cwd);
  const configuredLanes = new Set((projectConfig.lanes ?? []).filter((l) => l in AUTHORING_LANE_PACKAGES));
  const installedLanes = new Set(Object.keys(provenance.lanes ?? {}));
  for (const lane of configuredLanes) {
    if (!installedLanes.has(lane)) {
      issues.push({ lane, type: 'lane-selection-drift', detail: `multilane.config.json declares lane "${lane}" but authoring for it is not installed.` });
    }
  }
  for (const lane of installedLanes) {
    if (projectConfig.lanes?.length && !configuredLanes.has(lane)) {
      issues.push({ lane, type: 'lane-selection-drift', detail: `Authoring for lane "${lane}" is installed but multilane.config.json no longer declares it.` });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function formatCheckReport(result) {
  if (result.ok) return '✓ mlt authoring check: no drift detected.\n';
  const lines = ['✖ mlt authoring check: drift detected.', ''];
  for (const issue of result.issues) {
    lines.push(`[${issue.type}]${issue.lane ? ` (${issue.lane})` : ''} ${issue.detail}`);
  }
  lines.push('');
  lines.push('Note: a digest mismatch proves the file changed since install — it does not authenticate the');
  lines.push('publisher. Package supply-chain trust comes from npm integrity + registry access controls.');
  return lines.join('\n') + '\n';
}
