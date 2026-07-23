# Copilot Instructions — multilanetesting

Use this file as a thin adapter only.

## Canonical Source

- Start with [`AGENTS.md`](../AGENTS.md) for rules, routing, memory policy, lane guardrails, and publishing workflow.
- Query `docs/memory/*` first, then `docs/test-strategy.md`, `docs/coverage-map.md`, and `docs/traceability.md`.
- Open `docs/reference/*` only when the first two layers are insufficient.
- If `graphify-out/graph.json` exists, prefer graphify tools before source grep for architecture questions.

## Hard Guardrails

- AI at authoring only; never in runtime test execution.
- No host literals in committed files; use env-var names only.
- No secrets in prompts, memory, or committed files.
- Prefer the smallest safe implementation; do not add abstractions without proof.

## Copilot Routing

- Description match invokes the matching prompt/agent.
- Slash command overrides semantic matching.
- Ambiguous match asks one short question.
- No clear match uses normal tool-based execution.
- For non-trivial unmatched tasks, route through `orchestrate`.

## Keep This File Short

Do not duplicate long policy text from [`AGENTS.md`](../AGENTS.md). Add only Copilot-specific adapter notes.
