// @multilane/cli — `mlt authoring configure <configureId>`.
//
// Prints exact, repository-supported configuration steps for an optional capability's declared
// prerequisite instead of inventing unsupported behavior. Two prerequisite kinds are modeled:
// `mcpServers` (matches AGENTS.md → "MCP server wiring") and `env` (a project environment variable,
// e.g. MULTILANE_TARGET_HOST) — matching the lane-specific `.github/instructions/*` conventions.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUTHORING_LANE_PACKAGES } from './registry.mjs';
import { resolveAuthoringPackage } from './resolve.mjs';

export function describeConfigure(configureId, { cwd = process.cwd() } = {}) {
  for (const [lane, pkgName] of Object.entries(AUTHORING_LANE_PACKAGES)) {
    const resolved = resolveAuthoringPackage(pkgName, { cwd });
    if (!resolved) continue;
    const manifest = JSON.parse(readFileSync(join(resolved.dir, 'lane.manifest.json'), 'utf8'));
    const asset = [...(manifest.skills ?? []), ...(manifest.agents ?? [])].find((a) => a.configureId === configureId);
    if (!asset) continue;
    const servers = asset.requires?.mcpServers ?? [];
    const envVars = asset.requires?.env ?? [];
    const steps = [
      ...servers.map(
        (s) =>
          `- Add an MCP server entry named "${s}" to .vscode/mcp.json (VS Code Copilot Chat) or .mcp.json\n  (Claude Code / Copilot CLI). See this engine's own .mcp.json for a reference entry.`,
      ),
      ...envVars.map((name) => `- Set ${name} in the project's environment (e.g. .env) — never commit a literal value.`),
    ];
    return [
      `Configure "${configureId}" (${asset.id}, lane "${lane}"):`,
      '',
      ...steps,
      '',
      `Then re-run: mlt authoring install --lanes ${lane}`,
    ].join('\n');
  }
  return `No authoring asset with configureId "${configureId}" was found among the installed/resolvable lane packages.`;
}
