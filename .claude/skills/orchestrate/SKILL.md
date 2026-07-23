---
name: orchestrate
description: Route a multilanetesting task to the lightest effective execution path after reading repo context. Picks solo work, a single specialist agent, parallel agents, or an agent team based on scope. Use for non-trivial work that does not match a more specific skill.
user-invocable: true
---

# orchestrate

Route a task to the **lightest path that still does it well**. Read context first, then choose.

## Execution ladder (default to the top)

1. **Solo** — one target area, known channel, small file impact. The default.
2. **Single specialist agent** — focused discovery (`screen-explorer`), authoring
   (`screen-test-designer`), or debugging (`screen-flake-debugger`).
3. **Parallel agents** — 2–3 independent slices on separate areas/files.
4. **Agent team** — multi-stage dependent work across areas (explore → author → validate).

## Routing rules

- **Unknown screen / new target** → `screen-exploration` (discover and freeze locators).
- **Frozen locators exist, need a spec** → `screen-test-implementation`.
- **Flaky/drifted spec** → `screen-flake-hardening`.
- **Pre-PR** → `pr-hygiene` (or `repo-keeper`).
- **Tool choice (driver vs MCP vs Playwright)** → `screen-operator`.
- **Phase 0 feasibility** → solo, gated; do not skip the sign-off.

## Before routing

1. Query `docs/memory/*` (selector/route/blocker/feature index) for what's already known.
2. Confirm the target's functional channel (socket / control tree / template) and a safe **test partition**.
3. Confirm whether AI is even needed — most runtime work is deterministic replay with no agent at all.

## Output shape

**A.** one-line goal · **B.** what to build now · **C.** what to delay · **D.** exact next prompt/command.
