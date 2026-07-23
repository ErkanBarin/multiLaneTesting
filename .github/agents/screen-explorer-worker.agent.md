---
name: screen-explorer-worker
description: Hidden worker for live screen-target inspection and locator freezing. Wraps the Claude screen-explorer agent.
tools: ["read", "search", "edit", "execute"]
user-invocable: false
---

# screen-explorer-worker

Hidden Copilot worker. Source of truth:
[`.claude/agents/screen-explorer.md`](../../.claude/agents/screen-explorer.md) +
[`.claude/skills/screen-exploration/SKILL.md`](../../.claude/skills/screen-exploration/SKILL.md).

Explore a screen-only target in an isolated session against a recorded RPS scenario in a **test
partition** (never `PROD`). Resolve controls to the highest tier (object/control tree → template → vision
discovery, authoring only), verify each resolves **twice** identically, and propose freezes under
`locators/<area>/` + `docs/memory/selector-index.md`. Prefer Tier 1; no host literals; no secrets to
any model. Hand off to `screen-test-designer-worker`.
