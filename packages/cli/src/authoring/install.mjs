// @multilane/cli — `mlt authoring install` core.
//
// Resolves each requested lane's authoring package, evaluates prerequisites per asset, and
// materializes tool-specific files into approved project-scoped locations (`.claude/`, `.github/`).
// Writes deterministic provenance for `mlt authoring check` / `mlt authoring update` to consume.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AUTHORING_LANE_PACKAGES, ALL_KNOWN_LANES, IMPLEMENTED_AUTHORING_LANES } from './registry.mjs';
import { resolveAuthoringPackage } from './resolve.mjs';
import { checkAssetPrerequisites } from './prerequisites.mjs';
import { renderTarget, SUPPORTED_TOOLS } from './render.mjs';
import { digestContent } from './digest.mjs';
import { readProvenance, writeProvenance, sortDeep } from './provenance.mjs';

const TOOL_FOR_FORMAT = {
  claude: 'claude',
  'copilot-prompt': 'copilot',
  'copilot-agent': 'copilot',
};

/**
 * @param {{ lanes: string[], tools?: string[], cwd?: string, env?: object, force?: boolean }} options
 * @returns {{ ok: boolean, laneReports: Array<object> }}
 */
export function installAuthoring({ lanes, tools = SUPPORTED_TOOLS, cwd = process.cwd(), env = process.env, force = false }) {
  const requested = [...new Set(lanes ?? [])];
  if (requested.length === 0) {
    throw new Error('Select at least one lane: mlt authoring install --lanes web,http,stomp,screen');
  }
  for (const lane of requested) {
    if (!ALL_KNOWN_LANES.includes(lane)) {
      throw new Error(`Unknown lane "${lane}". Known lanes: ${ALL_KNOWN_LANES.join(', ')}`);
    }
  }
  const selectedTools = [...new Set(tools)];
  for (const tool of selectedTools) {
    if (!SUPPORTED_TOOLS.includes(tool)) {
      throw new Error(`Unsupported tool target "${tool}". Supported: ${SUPPORTED_TOOLS.join(', ')}`);
    }
  }

  const provenance = readProvenance(cwd) ?? { schemaVersion: 1, lanes: {} };
  const laneReports = [];

  for (const lane of requested) {
    if (!IMPLEMENTED_AUTHORING_LANES.includes(lane)) {
      laneReports.push({
        lane,
        status: 'unavailable',
        detail: `No authoring package yet for lane "${lane}" — see LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md §10.`,
      });
      continue;
    }
    const pkgName = AUTHORING_LANE_PACKAGES[lane];
    const resolved = resolveAuthoringPackage(pkgName, { cwd });
    if (!resolved) {
      laneReports.push({
        lane,
        status: 'error',
        detail: `Could not resolve "${pkgName}" from ${cwd}. Add it as a devDependency and run npm install.`,
      });
      continue;
    }

    const manifest = JSON.parse(readFileSync(join(resolved.dir, 'lane.manifest.json'), 'utf8'));
    const previous = provenance.lanes[lane];
    const laneResult = installLane({ lane, manifest, pkg: resolved.pkg, pkgDir: resolved.dir, tools: selectedTools, cwd, env, force });
    // "unchanged" = the new provenance record is byte-equal to the previous one (same package
    // version, same source digests, same rendered targets) — the on-disk files were still
    // (re)written deterministically, so a drifted file gets repaired either way.
    const status = !previous
      ? 'installed'
      : JSON.stringify(sortDeep(previous)) === JSON.stringify(sortDeep(laneResult.record))
        ? 'unchanged'
        : 'updated';
    laneReports.push({ lane, status, ...laneResult });
    provenance.lanes[lane] = laneResult.record;
  }

  const anyError = laneReports.some((r) => r.status === 'error');
  if (laneReports.some((r) => r.status === 'installed' || r.status === 'updated')) {
    writeProvenance(cwd, provenance);
  }

  return { ok: !anyError, laneReports };
}

function installLane({ manifest, pkg, pkgDir, tools, cwd, env, force }) {
  const assets = [...(manifest.skills ?? []), ...(manifest.agents ?? [])];
  const assetReports = [];

  for (const asset of assets) {
    const prereq = asset.always ? { ok: true, reasons: [] } : checkAssetPrerequisites(asset, { cwd, env });
    const sourcePath = join(pkgDir, asset.source);
    const sourceContent = readFileSync(sourcePath, 'utf8');
    const sourceDigest = digestContent(sourceContent);

    if (!prereq.ok) {
      assetReports.push({
        id: asset.id,
        kind: asset.kind,
        status: 'not-enabled',
        reason: prereq.reasons.join(' '),
        configureId: asset.configureId ?? null,
        sourcePath: asset.source,
        sourceDigest,
        targets: [],
      });
      continue;
    }

    const allTargetPaths = new Map(Object.entries(asset.targets ?? {}).map(([format, t]) => [format, t.path]));
    const writtenTargets = [];
    for (const [format, target] of Object.entries(asset.targets ?? {})) {
      const tool = TOOL_FOR_FORMAT[format];
      if (!tool || !tools.includes(tool)) continue;
      const content = renderTarget(format, asset, sourceContent, target.path, allTargetPaths);
      const abs = join(cwd, target.path);
      if (existsSync(abs) && !force && !isKnownTarget(cwd, target.path)) {
        throw new Error(
          `Refusing to overwrite existing file not previously installed by mlt authoring: ${target.path} (pass force to override).`,
        );
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
      writtenTargets.push({ tool, format, path: target.path, digest: digestContent(content) });
    }

    assetReports.push({
      id: asset.id,
      kind: asset.kind,
      status: 'enabled',
      sourcePath: asset.source,
      sourceDigest,
      targets: writtenTargets,
    });
  }

  return {
    record: {
      authoringPackage: manifest.authoringPackage,
      authoringVersion: pkg.version,
      runtimePackage: manifest.runtimePackage,
      compatibility: manifest.compatibility,
      manifestDigest: digestContent(JSON.stringify(manifest)),
      assets: assetReports,
    },
    enabled: assetReports.filter((a) => a.status === 'enabled').map((a) => a.id),
    notEnabled: assetReports.filter((a) => a.status === 'not-enabled'),
  };
}

// A target path counts as "known" if the current on-disk provenance already tracked it (re-running
// install for a lane we already installed is always allowed to overwrite its own prior output).
function isKnownTarget(cwd, targetPath) {
  const provenance = readProvenance(cwd);
  if (!provenance) return false;
  for (const lane of Object.values(provenance.lanes ?? {})) {
    for (const asset of lane.assets ?? []) {
      if ((asset.targets ?? []).some((t) => t.path === targetPath)) return true;
    }
  }
  return false;
}

export function formatInstallReport(laneReports) {
  const lines = [];
  for (const r of laneReports) {
    if (r.status === 'unavailable') {
      lines.push(`⚠ ${r.lane}: ${r.detail}`);
      continue;
    }
    if (r.status === 'error') {
      lines.push(`✖ ${r.lane}: ${r.detail}`);
      continue;
    }
    lines.push(`${capitalize(r.lane)} authoring ${r.status === 'unchanged' ? 'unchanged (already up to date)' : r.status}.`);
    lines.push('');
    if (r.enabled.length) {
      lines.push('Available:');
      for (const id of r.enabled) lines.push(`- ${id}`);
      lines.push('');
    }
    if (r.notEnabled.length) {
      lines.push('Not enabled:');
      for (const a of r.notEnabled) lines.push(`- ${a.id}`);
      lines.push('');
      for (const a of r.notEnabled) {
        lines.push('Reason:');
        lines.push(a.reason);
        if (a.configureId) {
          lines.push('');
          lines.push('Configure with:');
          lines.push(`mlt authoring configure ${a.configureId}`);
        }
        lines.push('');
      }
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
