---
name: repo-keeper
description: Validate multilanetesting repo hygiene — types/lint, the no-runtime-AI guard, frozen-locator inventory sync, traceability, evidence, host-literal sanitization, and whether docs/memory/* needs updating. Read-only first; reports before editing.
argument-hint: <optional scope, e.g. "the mil-areas change">
agent: repo-keeper-worker
tools: ["read", "search", "edit", "execute"]
---

# /repo-keeper

Source of truth: [`.claude/agents/repo-keeper.md`](../../.claude/agents/repo-keeper.md) +
[`.claude/skills/pr-hygiene/SKILL.md`](../../.claude/skills/pr-hygiene/SKILL.md).

Run the PR-hygiene checklist **read-only first**, then report what needs changing before editing:
determinism (spec passes ×2), `check:no-runtime-ai`, partition safety (never `PROD`), functional gate,
frozen-locator sync (`docs/memory/selector-index.md`), traceability (`requirement_ref` +
`docs/traceability.md`), evidence, **host-literal sanitization** (env-var names only — item 8),
memory hygiene, and `typecheck`/`lint`.

Update `docs/memory/*` only for durable route/locator/blocker/coverage/traceability facts; bump "Last
verified" only for files actually reviewed. Prefer operational truth docs when memory disagrees.

**Return:** A. one-line goal · B. pass/fail per item · C. fixes deferred · D. exact commands to go green.
