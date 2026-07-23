# multilanetesting

A standalone, deterministic **multi-lane testing framework** for all multi-surface verification surfaces:

- **Screen driver (core new lane)** — screen-only HMI, desktop application, and COTS targets over VNC/RDP. AI discovers
  and *freezes* locators at authoring time; runs replay them deterministically with no model.
- **Web / DOM** — Playwright + selector factories for any target that exposes a real DOM.
- **API contract** — passive HTTP/JSON shape checks (opt-in, `MULTILANE_API_CONTRACT=1`).
- **WebSocket contract** — passive STOMP subscribe + supervised active SEND (opt-in).

This repository is the *seed*. You point an AI coding agent at
[`BOOTSTRAP_PROMPT.md`](BOOTSTRAP_PROMPT.md), and the agent implements the framework
phase-by-phase against [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), reusing the
templates already provided here (agents, skills, prompts, memory system, RAG, CI, dependencies).

It mirrors the proven `a DOM-focused test suite` customization + memory + orchestration model and extends it with
a deterministic screen-driver lane — the **only** fundamentally new addition. Everything else
(Playwright, API contract, WS contract, Robot orchestration, memory, CI) is the same stack.

---

## Why this exists

`a DOM-focused test suite` tests an Angular app through the **DOM** with Playwright. That works because the web application
HMI exposes a queryable DOM. Many multi-surface verification targets do **not**: the screen-only HMI renders through a
C++ HMI, desktop application and COTS products render to a framebuffer behind VNC/RDP. There is no DOM to
query, so Playwright's selector engine has nothing to bind to.

`multilanetesting` solves this with a **deterministic, AI-at-authoring** screen-driver lane, while
also carrying the familiar lanes we already use in `a DOM-focused test suite`:

- **AI is used at authoring time** to discover controls on screen-only targets and *freeze* a stable locator.
- **AI is never used at runtime.** Frozen locators replay deterministically — near-zero AI cost,
  fully reproducible, CI-safe.
- DOM/REST/STOMP surfaces continue to use the same Playwright / API-contract / WS-contract lanes.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the driver tiers, oracles, and deterministic-world model.

---

## What's in the box

| Path | What it is |
|---|---|
| [`BOOTSTRAP_PROMPT.md`](BOOTSTRAP_PROMPT.md) | The master prompt you hand to an AI agent to build the repo |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Full phased plan (Phase 0 → 4) with deliverables and acceptance gates |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Driver tiers, three oracles, deterministic replay, building-blocks table, risks |
| [`AGENTS.md`](AGENTS.md) | Cross-agent entrypoint (auto-attached by VS Code, Copilot CLI, Cursor, Codex, etc.) |
| [`CUSTOMIZATION_MAP.md`](CUSTOMIZATION_MAP.md) | Claude ↔ Copilot mirror table and the wrap pattern |
| [`CLAUDE.md.example`](CLAUDE.md.example) | Template for your local `CLAUDE.md` (gitignored — holds env-specific operational truth) |
| [`docs/onboarding.md`](docs/onboarding.md) | Step-by-step onboarding: clone → env → Phase 0 → first test |
| `.github/copilot-instructions.md` | GitHub Copilot adapter (short pointer to `AGENTS.md`) |
| `.github/instructions/*.instructions.md` | Path-scoped lane rules (screen / web / api / ws) |
| `.github/agents/*.agent.md` | Copilot custom agents (orchestrator + hidden workers) |
| `.github/prompts/*.prompt.md` | Copilot slash-command wrappers |
| `.claude/agents/*.md` | Claude specialist agents (source of truth) |
| `.claude/skills/*/SKILL.md` | Claude reusable workflows (source of truth) |
| `docs/memory/*` | Curated, compact repo memory (the same system `a DOM-focused test suite` uses) |
| `docs/ci/*` | Robot orchestration + Jenkins pipeline templates |
| `docs/rag/graphify-notes.md` | Knowledge-graph (Graphify) wiring notes |
| `package.json`, `pyproject.toml` | JS-lane and Python screen-driver-lane dependency manifests |
| `.mcp.json`, `.vscode/mcp.json` | MCP server wiring (Playwright + screen-driver MCP) |
| `Jenkinsfile`, `.env.example`, `.gitignore` | CI entrypoint, environment template, ignore rules |

---

## Publishing `@multilane/*` packages to Nexus

This repo is the **engine source.** All 10 `@multilane/*` packages (`core`, `cli`, `web`, `http`,
`stomp`, `screen`, `playwright-config`, `authoring-web`, `authoring-http`, `authoring-stomp`)
publish to the corporate Nexus registry when you push to `main` — **live and verified**:

1. **Make your changes** — update code, fix bugs, add features.
2. **Bump versions** — `npm version patch -w @multilane/<pkg>` for each package that changed.
3. **Push to main** — Git host webhook triggers the Jenkins pipeline automatically.
4. **Pipeline runs** — checkout → install → validate (lint/tests/guards) → publish (all 10 in order).
   Every npm step runs inside the MDT `node<ver>-chrome` container via the shared library's `mdtNode`
   step — the agents have no Node/npm/nvm of their own.
5. **Verify** — packages appear in Nexus at new versions. Downstream consumers can install.

**See [`AGENTS.md` → "Publishing workflow"](AGENTS.md#publishing-workflow)** for how CI provisions
Node (`mdtNode`), the `NODE_VERSION` / `NPM_RELEASE_REPOSITORY` settings, and troubleshooting.

---

## How to use it

**→ Read [`docs/onboarding.md`](docs/onboarding.md) for the full step-by-step.** Short version:

1. `git clone https://github.com/ErkanBarin/multiLaneTesting.git && cd multiLaneTesting`
2. `npm install`
3. `cp .env.example .env` — fill in the values for your target system.
4. `cp CLAUDE.md.example CLAUDE.md` — fill in your system's local operational truth (Claude only).
5. Open the repo in your AI agent and say: *"Follow `BOOTSTRAP_PROMPT.md`. Implement Phase 0 only
   for `<your system name>` and stop for my sign-off."*

> **This kit ships both ways** — it ships the *plan, conventions, and AI customization* for building
> a system's tests, **and** the reusable engine as versioned `@multilane/*` packages your test
> projects consume from Nexus (see below).

---

## Using multilanetesting in your system tests

The engine ships as versioned `@multilane/*` packages from the internal Nexus registry. Your
per-system test project **consumes** the engine — it never vendors framework source. Full public
surface: [`docs/API.md`](docs/API.md).

### 1. Scaffold a project

```bash
npx @multilane/cli new my-system --lanes web,http   # lanes: web, http, stomp, screen
cd my-system
```

The generated project has a config skeleton, a frozen-`locators/` dir, one example spec per selected
lane, a proxy/Nexus-aware `.npmrc`, and a thin `Jenkinsfile`. Lanes are **independently optional** —
an `http`-only project never pulls Playwright or the STOMP stack.

### 2. Install from Nexus (behind the proxy)

```bash
cp .npmrc.sample .npmrc     # scope @multilane -> Nexus via env vars; no secret committed
npm ci
npx playwright install chromium   # web lane only
```

### 3. Extend the config preset

```ts
// playwright.config.ts
import { definePlaywrightConfig } from '@multilane/playwright-config';
export default definePlaywrightConfig({ testDir: './tests/web' });
```

Target values come from the environment (`MULTILANE_WEB_BASE_URL`, `MULTILANE_TARGET_HOST`, …) — no
host literals in committed files.

### 4. Freeze locators (AI allowed here)

Locator discovery/freezing is an **authoring-time** activity (local CV + offline OCR, human-reviewed).
Frozen locators live under `locators/<area>/<key>.json` and replay deterministically — **no AI at
runtime**.

### 5. Run deterministically

```bash
npm run verify        # mlt verify — the deterministic gates (no-runtime-ai + robot-contract)
npm run test:http     # run a lane
```

### 6. Wire up Jenkins (no Docker)

Register the `multilane-jenkins` Shared Library (see
[`ci/jenkins-shared-library/`](ci/jenkins-shared-library/README.md)) and keep the `Jenkinsfile` thin:

```groovy
@Library('multilane-jenkins') _
runLaneTests(lanes: 'web,http', targetUrl: params.TARGET_URL, nodeVersion: '22.11.0')
```

The pipeline provisions Node, writes the Nexus `.npmrc`, `npm ci`, installs Chromium through the
proxy (web lane), runs `mlt verify` + the requested lanes, and archives JUnit + traces.

> **Dogfood it:** `npm run dogfood` packs the engine, installs it from tarballs into an example
> consumer, and runs a smoke suite — proving the *packaged* engine works end-to-end, offline.

### Real-world consumers — the estate pattern

A system under test never lives in this repo. The proven shape is a separate, small **estate repo**
owned by whoever runs the tests (e.g. `<your-org>/muac-test-estate`): an npm workspace root with one
self-contained `systems/<name>/` project per system, each scaffolded with `mlt new` and consuming
`@multilane/*` from Nexus like any other npm dependency. That pattern has been stood up and verified
offline end-to-end — per-system `mlt verify` gates pass, cwd-scoped config gives provable
cross-system isolation (confirmed via `strace`), and lane-minimalism holds (an `http`-only system
pulls no Playwright/STOMP deps). One Jenkins job per system, no Docker, wired through the same
`runLaneTests` Shared Library contract (see `ci/jenkins-shared-library/`), wrapped in a thin
monorepo-scoping step on the estate side.

**One link that pattern cannot prove offline:** whether `npm install` actually resolves the seven
`@multilane/*` packages from Nexus through a corporate proxy on a real agent — no fully offline
sandbox can reach a real registry to test this. Treat that install as its own isolated smoke test
(no lanes, no `mlt verify` — just the install plus a report of what resolved) on a real Jenkins agent
*before* trusting a full per-system job.

---

## Guardrails baked in (same as `a DOM-focused test suite`)

- **No host literals in committed files** — reference targets by env-var name
  (`SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION`, …). Single source of truth is `.env` (gitignored).
- **No secrets to any model** — never send credentials, PATs, or `.env` to a vision/computer-use API.
- **Deterministic at runtime** — locator discovery (local CV + offline OCR) is authoring-only; CI replays frozen locators.
- **Replay only into test partitions** — never `PROD`. See `ARCHITECTURE.md`.
- **Curated memory, not transcripts** — store verified, reusable facts only; see `docs/memory/README.md`.

---

## Relationship to `a DOM-focused test suite`

`a DOM-focused test suite` tests the web application Angular frontend and stays on Playwright. `multilanetesting` is a
*sibling* framework intended for **other multi-surface systems** (and can cover their DOM/REST/WS surfaces
too). Both share the same agent workflow (`*-explorer → *-test-designer → repo-keeper`), the same
memory model, the same Robot-Framework orchestration pattern, and the same PR-hygiene discipline.
If you already know `a DOM-focused test suite`, you already know how to operate `multilanetesting` — the only
new thing to learn is the screen-driver lane for no-DOM targets.
