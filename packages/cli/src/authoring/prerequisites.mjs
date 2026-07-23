// @multilane/cli — optional-capability prerequisite checks.
//
// An authoring agent that declares `requires.mcpServers` is only materialized once the prerequisite
// is detected — the installer never silently exposes a non-functional agent. Detection reads the
// same project-scoped MCP config files this repo already documents (`AGENTS.md` → "MCP server
// wiring"): `.vscode/mcp.json` (VS Code Copilot Chat) and `.mcp.json` (Claude Code / Copilot CLI).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function checkMcpServerConfigured(serverName, { cwd = process.cwd() } = {}) {
  const candidates = [join(cwd, '.vscode', 'mcp.json'), join(cwd, '.mcp.json')];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      continue;
    }
    const servers = parsed.servers ?? parsed.mcpServers ?? {};
    if (Object.prototype.hasOwnProperty.call(servers, serverName)) {
      return { ok: true, detail: `found "${serverName}" in ${path}` };
    }
  }
  return {
    ok: false,
    detail: `${serverName} MCP configuration was not detected in .vscode/mcp.json or .mcp.json`,
  };
}

/**
 * Evaluate every prerequisite an asset declares (`requires.mcpServers`, `requires.env`).
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkAssetPrerequisites(asset, { cwd = process.cwd(), env = process.env } = {}) {
  const reasons = [];
  for (const server of asset.requires?.mcpServers ?? []) {
    const result = checkMcpServerConfigured(server, { cwd });
    if (!result.ok) reasons.push(capitalize(result.detail));
  }
  for (const name of asset.requires?.env ?? []) {
    if (!env[name]) reasons.push(`Environment variable ${name} is not set.`);
  }
  return { ok: reasons.length === 0, reasons };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
