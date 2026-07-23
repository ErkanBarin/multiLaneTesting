---
name: screen-memory-recall
description: Read-only context loader. Walks the multilanetesting memory tiers in order (compact indices → operational truth → heavyweight reference) and reports what is already known about a target, area, locator, blocker, or requirement before any work begins. Does not edit files.
argument-hint: <topic, e.g. "sample-panel locators" or "what blocks the desktop application lane">
tools: ["read", "search"]
---

# /screen-memory-recall

Copilot-only read-only context loader (no Claude-side body — the recall policy lives in
[`AGENTS.md`](../../AGENTS.md) → "Memory and recall").

Walk the tiers **in order** and stop as soon as the question is answered:

1. **`docs/memory/*`** — compact curated indices (route-map, selector-index, feature-index,
   blocker-index, requirement-index, source-map, agent-query-guide). Query this first.
2. **Operational truth** — `AGENTS.md`, `.github/copilot-instructions.md`,
   `.github/instructions/*.instructions.md`, `docs/test-strategy.md`, `docs/coverage-map.md`,
   `docs/traceability.md`.
3. **`docs/reference/*`** — heavyweight source docs. Only when tiers 1–2 are insufficient.

**Return** a short brief: what is known (with file path + "Last verified"), what is blocked and why,
and the lightest next step. **Never edit** — this prompt only loads context.
