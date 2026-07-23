---
name: orchestrate
description: Route a multilanetesting task to the lightest effective execution path (solo, single agent, parallel agents, or agent team) after reading repo context.
argument-hint: <task to route, e.g. "add a spec for the mil-areas editor on the screen-only HMI">
agent: orchestrator
tools: ["agent", "read", "search"]
---

# /orchestrate

Source of truth: [`.claude/skills/orchestrate/SKILL.md`](../../.claude/skills/orchestrate/SKILL.md).

Route the task to the lightest path that still does it well. Before routing:

1. Query `docs/memory/*` for what is already known about the target/area.
2. Confirm the functional channel (socket / control tree / template) and a safe **test partition**.
3. Confirm whether AI is needed at all — most runtime work is deterministic replay.

Then pick: **solo** → **single specialist** (`screen-explorer` / `screen-test-designer` /
`screen-flake-debugger` / `repo-keeper`) → **parallel agents** → **agent team**. Respect the
non-negotiables in `AGENTS.md` (AI at authoring only; replay into a test partition, never `PROD`).

**Return:** A. one-line goal · B. chosen path + why · C. what is deferred · D. exact next prompt/command.
