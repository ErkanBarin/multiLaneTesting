# Memory system flow — `multilanetesting`

How memory is **stored, recalled, and updated**. Adapted from the web application memory model and the Robot
orchestration contract, for a black-box screen-testing framework. This file is the source of truth for
the policy; `AGENTS.md` carries the short canonical pointer.

## 1. Purpose

Curated repo memory holds **verified, reusable knowledge** that changes future decisions. It is not an
automatic chat/transcript memory. If a fact would not change what an agent does next, it does not
belong here.

## 2. Tiers (read in order)

1. **Compact indices** — `docs/memory/*`. Query first.
2. **Operational truth** — `AGENTS.md`, the Copilot adapter, path-scoped instructions, strategy /
   coverage / traceability docs.
3. **Heavyweight reference** — `docs/reference/*` (requirement specs, design descriptions).

Each AI tool reads its short **adapter** first (`.github/copilot-instructions.md` for Copilot,
`CLAUDE.md` for Claude — gitignored), which defers to `AGENTS.md` (canonical), which walks the tiers.

## 3. Knowledge graph (RAG)

When `graphify-out/graph.json` exists, prefer graph queries over grepping source files for
architecture, traceability, and cross-feature questions (~20× cheaper). See
[`../rag/graphify-notes.md`](../rag/graphify-notes.md). Rebuild after merging significant changes.

## 4. What we store

- **YES:** new targets/screens + channel, frozen locators (tier + resolver), blockers (honestly),
  coverage/traceability rows, requirement mappings, durable conventions.
- **NO:** raw chat, temp branch plans, one-off command output, tokens/PATs/`.env` values,
  host/IP literals, unverified assumptions.

## 5. How much

Just enough to route the next agent. A good entry has: **Feature/route · Current status · Exact file
path · Blocker/guardrail · Last verified date.**

## 6. Store decision (where does this fact go?)

| The fact is about… | Store in |
|---|---|
| *What* is covered | `docs/coverage-map.md` |
| *Where* a screen/route is | `docs/memory/route-map.md` |
| *How to locate* a control | `docs/memory/selector-index.md` (+ `locators/<area>/`) |
| *What we cannot prove* | `docs/memory/blocker-index.md` / `docs/traceability.md` |
| *Requirement mapping* | `docs/memory/requirement-index.md` / `docs/traceability.md` |
| *How an agent should behave* | `AGENTS.md` |

## 7. Recall → action → store (the loop)

1. **Recall** — `/screen-memory-recall <topic>` (read-only): walk tiers 1→3, stop when answered.
2. **Act** — explore / author / debug / validate.
3. **Store** — write durable findings back to the right index; bump "Last verified" for what you
   actually checked. Never store the prohibited list in §4.

## 8. Robot orchestration link (optional tier-1 wrapper)

A thin Robot Framework wrapper (`multilanetesting-robot`, sibling repo) can call this repo's npm/driver
scripts via the Process library and collect exit codes into a unified report — same pattern as the
web application `a DOM-focused test suite-robot` orchestration. Two tag systems stay in sync: Robot `[Tags]` vs framework
`@tags` in spec titles. A contract guard (`npm run check:robot-contract`) keeps the spec title, the
guard's tag list, and the contract doc aligned. Details:
[`../ci/robot-orchestration.md`](../ci/robot-orchestration.md).

## 9. Guardrails

- Phase-A discipline: docs-only memory. No transcript capture, no vector DB, no MCP memory server, no
  cron, no new runtime dependency just to "remember".
- Tool-local memory/logs may inform investigation but never override repo source of truth.
- Host literals are sanitized to env-var references in every committed file; real values live only in
  gitignored `.env`. `CLAUDE.md` stays gitignored as defense-in-depth.
