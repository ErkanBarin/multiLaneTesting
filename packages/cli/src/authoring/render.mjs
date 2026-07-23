// @multilane/cli — render tool-specific wrapper content from a source-of-truth asset.
//
// Convention (matches this repo's own `.claude/` ↔ `.github/` wrap pattern, see
// CUSTOMIZATION_MAP.md): the Claude-format file is materialized verbatim as the source of truth;
// Copilot wrappers are short, generated files that link back to it and add only Copilot-specific
// framing (`agent`, `tools`, front-matter). Copilot never receives a second hand-authored copy.
import { relative, dirname, sep } from 'node:path';

export const SUPPORTED_TOOLS = ['claude', 'copilot'];

/**
 * @param {'claude'|'copilot-prompt'|'copilot-agent'} targetKey  the manifest `targets` object key
 * @param {object} asset  the manifest entry (skill or agent)
 * @param {string} sourceContent  raw content of the source asset file
 * @param {string} targetPath  project-relative path this content will be written to
 * @param {Map<string,string>} allTargetPaths  targetKey -> project-relative path, for cross-links
 * @returns {string}
 */
export function renderTarget(targetKey, asset, sourceContent, targetPath, allTargetPaths) {
  switch (targetKey) {
    case 'claude':
      return sourceContent;
    case 'copilot-prompt':
      return renderCopilotPrompt(asset, targetPath, allTargetPaths);
    case 'copilot-agent':
      return renderCopilotAgentWorker(asset, targetPath, allTargetPaths);
    default:
      throw new Error(`Unsupported wrapper format "${targetKey}".`);
  }
}

function linkFrom(targetPath, otherPath) {
  const rel = relative(dirname(targetPath), otherPath).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function renderCopilotPrompt(asset, targetPath, allTargetPaths) {
  const claudePath = allTargetPaths.get('claude');
  const sourceLink = claudePath ? `[\`${claudePath}\`](${linkFrom(targetPath, claudePath)})` : 'the source-of-truth file';
  const agentLine = asset.kind === 'agent' && allTargetPaths.has('copilot-agent')
    ? `\nagent: ${asset.id}-worker\n`
    : '';
  return `---
name: ${asset.id}
description: ${asset.description}
${agentLine}tools: ["read", "search", "edit"]
---

# /${asset.id}

Source of truth: ${sourceLink}.

${asset.description}

**Return:** A. one-line goal · B. what was done · C. blockers deferred · D. next step.
`;
}

function renderCopilotAgentWorker(asset, targetPath, allTargetPaths) {
  const claudePath = allTargetPaths.get('claude');
  const sourceLink = claudePath ? `[\`${claudePath}\`](${linkFrom(targetPath, claudePath)})` : 'the source-of-truth file';
  return `---
name: ${asset.id}-worker
description: Hidden worker wrapping the ${asset.id} authoring agent from ${asset.title ?? asset.id}.
tools: ["read", "search", "edit"]
user-invocable: false
---

# ${asset.id}-worker

Hidden Copilot worker. Source of truth: ${sourceLink}.

${asset.description}
`;
}
