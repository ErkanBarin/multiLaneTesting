---
name: repo-keeper-worker
description: Hidden worker for multilanetesting repo hygiene, frozen-locator inventory sync, no-runtime-AI enforcement, and memory updates. Wraps the Claude repo-keeper agent.
tools: ["read", "search", "edit", "execute"]
user-invocable: false
---

# repo-keeper-worker

Hidden Copilot worker. Source of truth:
[`.claude/agents/repo-keeper.md`](../../.claude/agents/repo-keeper.md) +
[`.claude/skills/pr-hygiene/SKILL.md`](../../.claude/skills/pr-hygiene/SKILL.md).

Run the PR-hygiene checklist **read-only first**, then report before editing: determinism (spec ×2),
`check:no-runtime-ai`, partition safety (never `PROD`), functional gate, frozen-locator sync
(`docs/memory/selector-index.md`), traceability (`requirement_ref` + `docs/traceability.md`),
evidence, **host-literal sanitization** (env-var names only), memory hygiene, and `typecheck`/`lint`.
Update `docs/memory/*` only for durable facts; bump "Last verified" only for files actually reviewed.
