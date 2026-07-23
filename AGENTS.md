# AGENTS.md

Cross-tool entry point for AI coding agents working on **`multilanetesting`** — a deterministic
multi-lane testing framework for web, API, WebSocket, and screen-only surfaces. Auto-attached by VS Code
(`chat.useAgentsMdFile`), GitHub Copilot CLI, Cursor, Codex CLI, Windsurf, Amp, and Devin.

This file is intentionally thin — it points to canonical guidance instead of duplicating it.

Prefer the smallest safe implementation. Before adding abstractions, wrappers,
configuration, dependencies, or new files, prove they are required.

## Repo at a glance

`multilanetesting` — end-to-end verification across multiple testable surfaces.

| Lane | Surface | Tooling |
|---|---|---|
| **Web / DOM** | Browser UI | Playwright + selector factories |
| **API contract** | REST/HTTP endpoints | `node:https` / `tsx` (passive, opt-in) |
| **WS contract** | STOMP / WebSocket | `@stomp/stompjs` (passive + supervised active SEND, opt-in) |
| **Screen driver** | Framebuffer / VNC/RDP / C++ HMI / COTS | Deterministic driver; AI at authoring only |

Build only the lanes the target system exposes. Common to all lanes:
- No host literals in committed files — env-var names only. No secrets to any model.
- Tests read as short user scenarios with named steps describing intent and outcome.
- Same memory model, agent workflow, traceability discipline, and PR-hygiene checklist.

**Downstream consumers.** This repo never contains a system under test. A system under test lives in
its own small **estate repo**, one self-contained
`systems/<name>/` project per system (scaffolded via `mlt new`, isolated by cwd-scoped config — see
`docs/memory/source-map.md`).

**Screen-driver lane specifics** (applies only to that lane):
- AI at authoring, never at runtime. Frozen locators replay with no model in the loop.
- Driver tiers: object introspection (socket / control tree) → image template → vision (authoring only) → supervised heal.
- Three oracles: functional truth (the gate), rendering truth (golden image), legibility truth (OCR).
- Replay RPS scenarios into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`), never `PROD`.
- Frozen locators live under `locators/<area>/`; no runtime discovery.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) first.

## Where to look

| Question | Read this first |
|---|---|
| Conceptual model (tiers, oracles, replay) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What to build and in what order | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| Repo-wide guardrails (Copilot adapter) | [.github/copilot-instructions.md](.github/copilot-instructions.md) |
| Path-scoped lane rules | [.github/instructions/](.github/instructions/) — `*.instructions.md` with `applyTo:` globs |
| Copilot custom agents | [.github/agents/](.github/agents/) — orchestrator + hidden workers |
| Copilot prompts (slash-commands) | [.github/prompts/](.github/prompts/) |
| Claude specialist agents (source of truth) | [.claude/agents/](.claude/agents/) |
| Claude skills (reusable workflows) | [.claude/skills/](.claude/skills/) |
| Claude ↔ Copilot mirror + wrap pattern | [CUSTOMIZATION_MAP.md](CUSTOMIZATION_MAP.md) |
| Frozen-locator inventory | [docs/memory/selector-index.md](docs/memory/selector-index.md) |
| Lane strategy | [docs/test-strategy.md](docs/test-strategy.md) |
| Coverage matrix | [docs/coverage-map.md](docs/coverage-map.md) |
| Requirement traceability | [docs/traceability.md](docs/traceability.md) |
| Compact memory layer (query first) | [docs/memory/](docs/memory/) |
| Knowledge graph (architecture / cross-feature) | `/graphify` (install `graphifyy` as directed by `BOOTSTRAP_PROMPT.md`); see [docs/rag/graphify-notes.md](docs/rag/graphify-notes.md) |

## Memory and recall

`AGENTS.md` is the canonical cross-agent memory and recall policy. `CLAUDE.md` is the Claude adapter
(local, gitignored); `.github/copilot-instructions.md` is the Copilot adapter. Adapters carry short
pointers and tool-specific notes only — they must not duplicate large memory content.

This is a **curated repo memory system, not automatic transcript memory.** We store only verified,
reusable knowledge that saves the next task from rediscovery.

**Retrieval order (strict):**

1. `docs/memory/*` — curated, compact indices. **Query this layer first.**
2. Operational truth docs — `docs/test-strategy.md`, `docs/coverage-map.md`, `docs/traceability.md`,
   `locators/` inventory, `ARCHITECTURE.md`.
3. `docs/reference/*` — heavyweight source documents (if the project keeps any; untracked by
   default). Only when layers 1–2 are insufficient.
4. Tool-local memory/logs — local, read-only, **never authoritative**.

**Write rules:**

1. Durable findings that change routes, locators, blockers, coverage, or traceability go to the
   relevant repo doc; update `docs/memory/*` when the curated index must change.
2. Never write secrets, tokens, raw transcripts, local credentials, host literals, or unverified
   assumptions into repo memory.
3. Store **facts, not conversations**; compact indices, not duplicate documents; exact file paths;
   a "Last verified" date.
4. Tool-local memory may inform investigation but never overrides repo source of truth.
5. At the end of any non-trivial completed task, update `docs/memory/*` with only verified, reusable
   facts — see `.claude/skills/memory-learning-loop/SKILL.md` (Claude) or
   `.github/prompts/memory-learning-loop.prompt.md` (Copilot).

## Customization layer — wrap pattern

The **Claude side is the source of truth**; the Copilot side is a thin wrapper.

- `.claude/skills/<name>/SKILL.md` — canonical workflow body.
- `.claude/agents/<name>.md` — canonical specialist persona.
- `.github/prompts/<name>.prompt.md` — Copilot slash-command linking back to the matching skill/agent.
- `.github/agents/<name>-worker.agent.md` — hidden Copilot worker wrapping the Claude agent.

Change a skill/agent body on the Claude side and the Copilot wrapper picks it up automatically. See
[`CUSTOMIZATION_MAP.md`](CUSTOMIZATION_MAP.md).

## Skill and agent invocation

1. **Description match → invoke.** When the task semantically matches a registered skill/agent
   `description`, invoke it before generating any other response — slash command or not.
2. **Slash overrides matching.** `/<name>` invokes that name directly.
3. **Ambiguity → ask.** Two plausible matches → ask one short question. Do not guess.
4. **No match → improvise.** Plan and act with the standard tool palette. Do not invent a skill.
5. **`orchestrate` is the meta-router.** Non-trivial work with no specific match → invoke `orchestrate`.
6. **Ponytail.** Bootstrap installs the external Ponytail plugin; use it for implementation
   simplification and over-engineering reviews.

## Delegation policy

Use this routing precedence for every delegated task:

1. An explicit user or task-level model requirement.
2. A matching specialist skill or specialist agent.
3. An existing domain-specific worker appropriate for the task.
4. A generic low-cost worker.
5. Evidence-based escalation to a stronger model.

Generic workers are fallbacks only. They must never replace, retune, rename, weaken, or override a
matching specialist path or an explicit model requirement. The committed worker files carry no
`model` pin — they inherit the invoking session's model unless a concrete identifier is configured
locally. Invocation-time model selection takes priority over worker defaults; the capability tiers
below are preferences, not hard runtime pins.

| Routine unmatched task | Worker | Preferred capability tier, in order |
|---|---|---|
| Read-only repository mapping, discovery, documentation/configuration review, evidence collection | `cheap-repository-worker` | low-cost general model, then mid-tier coding model |
| Narrow read-only code, test, automation, or implementation review | `technical-worker` | mid-tier coding model, then stronger reasoning model |

The Copilot orchestrator at `.github/agents/orchestrator.agent.md` is the only constrained named
delegation entrypoint. It must keep the `agent` tool and an explicit allowlist containing exactly
these existing agent names unless a deliberate agent change updates both sides:

- `cheap-repository-worker`
- `technical-worker`
- `screen-explorer-worker`
- `screen-test-designer-worker`
- `screen-flake-debugger-worker`
- `repo-keeper-worker`

Keep specialist routing ahead of generic routing. Do not remove valid specialist workers from the
allowlist, create another orchestrator, prefer an unnamed inherited-model subagent for routine work,
or let either generic worker create subagents or modify files. If a generic worker name collides with
a different-purpose agent, preserve the existing agent and report the conflict rather than overwrite
or silently rename it.

Premium models handle orchestration, difficult reasoning, conflict resolution, and final synthesis.
Escalate beyond the preferred worker only when collected evidence leaves a material unresolved
question, and record the evidence, unresolved question, why the current worker is insufficient, and
the expected benefit. Architecture, security, conflicting evidence, or unresolved cross-repository
reasoning may justify escalation; cost alone never justifies bypassing a specialist. If a requested
model identifier cannot be verified in the current Copilot environment, preserve its requested order,
mark the identifier for manual verification, and do not silently substitute another model.

## MCP server wiring

Both `.mcp.json` (Copilot CLI / Claude Code standalone) and `.vscode/mcp.json` (VS Code Copilot
Chat) are committed with identical server names and scopes so exactly one instance per name runs.

- **`playwright`** — `@playwright/mcp`, for the optional web (DOM) lane and visual checks.
- **`screen-driver`** — the screen-introspection MCP (object socket / control-tree bridge) for authoring-time
  discovery and locator freezing. **Authoring only** — not reachable from a test run.

Per-developer overrides go in `.claude/settings.local.json` or VS Code user settings (untracked).

## Local-only operational truth

`CLAUDE.md` at the repo root is gitignored by design — it carries environment-specific operational
detail (host details, partitions, infra URLs) that must not reach remote. Do not commit it. Real host
values live only in `.env`. URL/host literals in tracked markdown are sanitized to env-var references
(`SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION`, …) — enforced by the `pr-hygiene` checklist.

## Coding style — ponytail

**Lazy-first, level: full.** On every code task, climb this ladder and stop at the first rung that holds:

1. Does this need to exist? Speculative need → skip it, say so in one line. (YAGNI)
2. Already in this codebase? Reuse it — look before you write.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dep solves it? Use it.
6. Can it be one line? Write one line.
7. Only then: the minimum code that works.

Shortest working diff wins. Mark deliberate shortcuts: `# ponytail: <ceiling>, <upgrade-path>`.
No unrequested abstractions, no boilerplate "for later", deletion over addition.

## Working style

- Lean first. Smallest useful slice. One spec per behavior.
- Build only the lanes the target system actually exposes (Phase 0 memo decides).
- No host literals in committed files — env-var names only.
- Tests read as short user scenarios with `test.step()` / named steps describing user intent.
- **Screen-driver lane:** AI at authoring, never at runtime. Frozen locators only. Replay into a
  test partition, never `PROD`. Functional truth is the gate.
- **Web lane:** Playwright selector factories, web-first assertions, no sleeps, no mocking.
- **API lane:** passive shape/status checks only, no state mutation.
- **WS lane:** passive SUBSCRIBE by default; active SEND requires both opt-in flags + approved-host preflight.

## Validation commands

| Gate | Command | Notes |
|---|---|---|
| Type check | `npm run typecheck` | |
| Lint | `npm run lint` | |
| Unit tests | `npm run test:unit` | |
| No-runtime-AI guard | `npm run check:no-runtime-ai` | |
| Robot tag contract | `npm run check:robot-contract` | |
| All engine gates | `npm run validate` | runs all of the above in order |
| PR hygiene | `/pr-hygiene` (or `/repo-keeper`) | |

Lane-specific test commands (`npm test -w systems/<name>`, `robot robot/`) run in your **estate
repo** against a system project — not here.
