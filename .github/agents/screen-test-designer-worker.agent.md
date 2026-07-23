---
name: screen-test-designer-worker
description: Hidden worker for authoring deterministic screen specs from frozen locators. Wraps the Claude screen-test-designer agent.
tools: ["read", "search", "edit", "execute"]
user-invocable: false
---

# screen-test-designer-worker

Hidden Copilot worker. Source of truth:
[`.claude/agents/screen-test-designer.md`](../../.claude/agents/screen-test-designer.md) +
[`.claude/skills/screen-test-implementation/SKILL.md`](../../.claude/skills/screen-test-implementation/SKILL.md).

Author one spec per behavior in `tests/<area>/` using **only** frozen Tier-1/2 locators. Replay an RPS
scenario into a **test partition** (never `PROD`). Assert **functional truth** as the gate; corroborate
with golden-image (mask volatile regions) + offline OCR; emit JUnit/HTML with a `requirement_ref`.
Steps name user intent, not mechanics. Missing/drifted locator → stop and route to
`screen-explorer-worker` or `screen-flake-debugger-worker`. Run twice; require identical readback.
Hand off to `repo-keeper-worker`.
