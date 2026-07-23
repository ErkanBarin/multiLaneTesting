---
name: screen-explorer
description: Discover and freeze stable Tier-1/Tier-2 locators on a live screen-only target (screen-only HMI, COTS, desktop application over VNC/RDP). Authoring-only; produces frozen locators, never a runtime path.
argument-hint: <area or screen to explore, e.g. "the sample panel editor on the screen-only HMI">
agent: screen-explorer-worker
tools: ["read", "search", "edit", "execute"]
---

# /screen-explorer

Source of truth: [`.claude/agents/screen-explorer.md`](../../.claude/agents/screen-explorer.md) +
[`.claude/skills/screen-exploration/SKILL.md`](../../.claude/skills/screen-exploration/SKILL.md).

Explore the target in an isolated session against a recorded RPS scenario in a **test partition**
(never `PROD`). Resolve each control to the highest tier: **object socket / control tree (Tier 1)** →
**image template, DPI/theme-stamped (Tier 2)** → **vision discovery (Tier 3, authoring only)**.
Verify each candidate resolves **twice** identically, then propose a freeze (tier, resolver key,
`requirement_ref`) under `locators/<area>/` and record it in `docs/memory/selector-index.md`.

Guardrails: prefer Tier 1; no host literals; never send secrets/operational data to a model; never
freeze a non-deterministic locator.

**Return:** A. one-line goal · B. frozen locators (area + keys + tier) · C. blockers deferred ·
D. next prompt (`/screen-test-designer <area>`).
