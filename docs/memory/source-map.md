# Source map — `multilanetesting`

Where each *kind* of truth lives, so agents write findings to the right place and readers know where to
look.

| Kind of truth | Lives in | Notes |
|---|---|---|
| Cross-agent policy (memory, invocation, working style) | `AGENTS.md` | Canonical; adapters defer to it |
| Subagent cost routing policy | `AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, `.github/agents/*.agent.md` | Configured low-cost worker defaults, constrained named delegation, and instruction-based escalation controls |
| Copilot adapter | `.github/copilot-instructions.md` | Short pointer only |
| Claude adapter (local) | `CLAUDE.md` | **gitignored** — may hold env-specific truth |
| Path-scoped rules | `.github/instructions/*.instructions.md` | `applyTo` globs |
| Architecture & driver tiers | `ARCHITECTURE.md` | The "how it works" |
| Compact memory | `docs/memory/*` | Query first |
| What's covered | `docs/coverage-map.md` | Coverage matrix |
| Test strategy / lanes | `docs/test-strategy.md` | UI + optional lanes |
| Requirement traceability | `docs/traceability.md` | Full matrix; SuV evidence boundary |
| Frozen-locator resolvers | `locators/<area>/` | Authoritative; `selector-index.md` summarizes |
| Specs | `tests/<area>/` | One spec per behavior |
| Deterministic drivers | `drivers/` | Frozen-locator replay; no runtime AI |
| RAG / graph | `graphify-out/graph.json`, `docs/rag/graphify-notes.md` | Prefer for cross-feature questions |
| CI / orchestration | `docs/ci/*`, `Jenkinsfile`, `orchestration/` | Robot wrapper analog |
| Host / secret values | `.env` (gitignored) | **Never** in committed files |
| Downstream consumer pattern | external `systems/<name>/` estate repos — **not part of this repo** | One npm project per system, scaffolded via `mlt new`, consumes `@multilane/*` from a configured npm registry; isolation is cwd-scoped config (`packages/core/src/config.mjs`), not a shared file. See `README.md` "Real-world consumers". |

## Rule

When you learn a durable fact, store it in the row above that matches its *kind* — not wherever you
happened to be working. If two places seem right, the more specific/compact one wins, and the others
point to it.
