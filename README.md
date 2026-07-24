# multilanetesting

A deterministic **multi-lane testing framework** for systems that expose more than one testable
surface — browser DOM, HTTP APIs, STOMP/WebSocket streams, and screen-only UIs (VNC/RDP,
framebuffer, COTS applications with no DOM).

**Core principle: AI may assist at authoring time; test execution is always deterministic.**
AI can help discover screen locators or draft specs, but every artifact that runs in CI is frozen,
reviewed, and replayed with no model in the loop — checked by a source-pattern gate and code
review (a policy heuristic, not a reachability proof).

## Status and maturity

This is a **reference implementation under active development**, not a finished product. Honest
state of each part:

| Component | Maturity | Notes |
|---|---|---|
| `@multilane/core` (config, gates, verify) | Working | Unit-tested; `mlt verify` runs the deterministic gates |
| `@multilane/cli` (`mlt new`, `mlt verify`, authoring) | Working | Scaffolds lane projects; unit-tested; `mlt create-system` exits nonzero if the authoring packages are not resolvable |
| `@multilane/http` (passive API contract) | Working | Read-only GETs, shape checks, timeouts, body caps |
| `@multilane/stomp` (WS contract) | Working | Passive SUBSCRIBE; active SEND double-gated (opt-in + allowlist) |
| `@multilane/screen` (frozen-locator runtime) | Working | Loads/validates frozen locators; PROD-partition refusal |
| `@multilane/web`, `@multilane/playwright-config` | Working | Selector factories + shared Playwright preset |
| `@multilane/authoring-*` (3 packages) | Working | Authoring-time manifests/assets only; never imported at runtime |
| Python screen driver (`pyproject.toml`) | **Stub** | Skeleton package; no actuation implemented, no tests yet |
| Robot orchestration (`orchestration/`) | **Template** | Documents an intended pattern; no runnable suites here |
| Jenkins shared library (`ci/`) | **Optional template** | Example integration; not required and not exercised by this repo's CI |

Packages are **not published to any registry**. Consume them via `npm pack` tarballs (see
[Dogfooding](#dogfooding-the-packaged-engine)) until a publishing decision is made.

## Who this is for — and how to adopt it

You own a system with one or more testable surfaces — a browser UI, an HTTP API, STOMP/WebSocket
streams, or a screen-only UI that DOM tools can't reach — and you want automated tests that behave
the same on every run. What adopting this engine buys you:

- **Deterministic CI** — no model calls during a run, so failures reproduce and reruns are cheap.
- **Coverage where DOM tools stop** — the screen lane tests VNC/RDP and COTS UIs via frozen,
  reviewed locators.
- **AI speed without AI risk** — agents help discover locators and draft specs at authoring time;
  a source-pattern gate keeps models out of every run.
- **One engine, many teams** — each team scaffolds its own small consumer project for its own
  system; the engine evolves centrally and is re-installed, not copied.
- **Evidence per run** — JUnit/HTML artifacts suitable for review and traceability.

Adoption is a scaffold, not a fork: your specs, locators, `.env`, and CI job live in your own
repository, and lanes are independently optional. To tailor it further — different lanes, adjusted
scaffold templates, your own authoring assets — the engine is a reference implementation designed
to be modified.

**Start here: [`docs/onboarding.md`](docs/onboarding.md)** — step by step from clone to a passing
first test against your system, including CI wiring and how to adapt the framework to your needs.

## Quickstart

Requires Node >= 20 and npm 10.

```bash
git clone https://github.com/ErkanBarin/multiLaneTesting.git
cd multiLaneTesting
npm ci
npm run validate     # no-runtime-AI gate + robot-contract gate + typecheck + lint + unit tests
npm run dogfood      # packs all 10 packages, installs them offline into example consumers, runs smoke tests
```

Everything above runs offline after `npm ci` — no target system, no credentials, no registry access.

> **Lockfile caveat:** `package-lock.json` was generated with npm 10 behind a restricted proxy.
> npm 11 (bundled with Node 24) may reject it during `npm ci`. If it does, regenerate the lockfile
> on an unrestricted network (`npm install --package-lock-only`) and review the diff.

## Architecture in one minute

Four independent lanes; build only the ones your target exposes:

| Lane | Surface | How it verifies |
|---|---|---|
| **Web / DOM** | Browser UI | Playwright + declarative selector factories |
| **API contract** | REST/HTTP | Passive GET + status/shape/header assertions (opt-in) |
| **WS contract** | STOMP/WebSocket | Passive SUBSCRIBE; active SEND requires opt-in **and** host allowlist |
| **Screen driver** | No-DOM UIs (VNC/RDP, C++ HMI, COTS) | Frozen Tier-1/2 locators replayed deterministically |

The screen lane is the novel part. AI-assisted discovery (object introspection, local CV, offline
OCR) happens at **authoring time** and produces a frozen locator JSON under `locators/<area>/<key>.json`,
reviewed like code. At runtime the driver only loads and replays frozen locators — and refuses to
run if the target partition resolves to `PROD`.

Details: [`ARCHITECTURE.md`](ARCHITECTURE.md) (tiers, oracles, deterministic-world model) and
[`docs/test-strategy.md`](docs/test-strategy.md).

## Packages

All engine code lives in npm workspaces under [`packages/`](packages/):

| Package | Purpose |
|---|---|
| `@multilane/core` | Env-driven config, deterministic gates (no-runtime-AI, robot-contract, partition), `verify` |
| `@multilane/cli` | `mlt new` (scaffold a consumer project), `mlt verify`, `mlt authoring` |
| `@multilane/web` | Selector-factory helpers for the Playwright lane |
| `@multilane/http` | Passive HTTP/JSON contract checks (built-in `node:http(s)` only) |
| `@multilane/stomp` | STOMP-over-WS subscribe + gated send (`@stomp/stompjs`/`ws` as optional peers) |
| `@multilane/screen` | Frozen-locator loading + validation (runtime surface of the screen lane) |
| `@multilane/playwright-config` | Shared Playwright preset (env-driven baseURL, JUnit/HTML evidence) |
| `@multilane/authoring-web` / `-http` / `-stomp` | Authoring-time lane manifests + skill/agent assets |

Public API surface: [`docs/API.md`](docs/API.md).

## Using the engine in a test project

Your system-under-test never lives in this repo — you scaffold a small consumer project. The
packages are **not published**, so run the CLI from a clone of this repo:

```bash
cd ..                                # scaffold next to your clone; names are lowercase [a-z0-9-]
node multiLaneTesting/packages/cli/bin/mlt.mjs new my-system --lanes web,http
node multiLaneTesting/scripts/install-tarballs.mjs my-system
cd my-system                         # lanes: web, http, stomp, screen
npm run verify
```

The generated `package.json` depends on `@multilane/*` packages that no registry serves yet.
[`scripts/install-tarballs.mjs`](scripts/install-tarballs.mjs) packs the engine workspaces into
`my-system/vendor/multilane/`, rewrites the scaffold's `@multilane/*` dependencies to those
tarballs (with `overrides` so nested engine deps stay local), and runs the first `npm install` —
which creates the consumer's `package-lock.json`. Commit the lockfile and `vendor/multilane/` so
the consumer's CI can run `npm ci` without the engine clone. The dogfood harness runs this exact
script against a fresh scaffold, offline. The installer supports POSIX platforms (on Windows use
WSL) and rejects project paths containing `#`, `%`, `\`, or `:` — characters npm cannot handle in
`file:` specs.

The generated project ships a config skeleton, a frozen-`locators/` dir, one example spec per lane,
a registry-agnostic `.npmrc` template, and an optional thin `Jenkinsfile`. Lanes are independently
optional — an `http`-only project pulls no Playwright or STOMP dependencies.

Target values always come from the environment (`MULTILANE_WEB_BASE_URL`, `MULTILANE_TARGET_HOST`,
`SCREEN_RPS_PARTITION`, …). **No host literals in committed files.**

```ts
// playwright.config.ts — extend the shared preset
import { definePlaywrightConfig } from '@multilane/playwright-config';
export default definePlaywrightConfig({ testDir: './tests/web' });
```

In the consumer project, `mlt verify` runs the same deterministic gates this repo runs on itself.

## Dogfooding the packaged engine

```bash
npm run dogfood
```

packs all 10 workspaces with `npm pack`, rewrites an example consumer
([`examples/consumer-smoke/`](examples/consumer-smoke/)) to install from those tarballs (with
`overrides` so nested workspace deps stay local), installs with npm's `--offline` flag, then runs
`mlt verify` plus an installation/export smoke across every package. It also runs a minimal
consumer (CLI + core only) and asserts `mlt create-system` exits nonzero when authoring packages
are unresolvable, and a scaffolded consumer (`mlt create-system` with the `http` lane) installed
offline by the same [`scripts/install-tarballs.mjs`](scripts/install-tarballs.mjs) users run,
gaining a `package-lock.json` and passing `mlt verify`. This proves the *packaged* engine installs and exports correctly with zero registry
access — it is a package-surface check, not functional lane coverage.

## Security model

- **No AI at runtime (policy)** — `npm run check:no-runtime-ai` pattern-scans runtime sources and
  fails the build when a configured forbidden pattern matches — or if it scans zero files. It is a
  finite source-pattern heuristic backed by code review, not a call-graph or reachability proof;
  dynamically constructed imports/URLs are outside its scope.
- **No host literals or secrets in the repo** — targets are env-var references; `.env` is gitignored.
- **Read-only by default** — the HTTP lane only GETs; the STOMP lane only subscribes. Active SEND
  requires an explicit inject flag **and** an approved-hosts allowlist match.
- **Operational-partition refusal** — the screen lane throws if `SCREEN_RPS_PARTITION` resolves to
  `PROD`, both at runtime and in the CI gate.
- **Pinned supply chain** — committed lockfile, exact dependency versions, SHA-pinned GitHub
  Actions, Dependabot enabled. The project's own packages define no lifecycle scripts (locked
  third-party dependencies may carry their own install scripts, e.g. esbuild).

Threat model and reporting process: [`SECURITY.md`](SECURITY.md).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `main` and on every pull
request: `npm ci`, the full
`validate` suite (gates, typecheck, lint, unit tests), a pack dry-run, the offline dogfood, and a
Python driver install/import smoke. No publishing, no releases.

Jenkins users: [`ci/jenkins-shared-library/`](ci/jenkins-shared-library/) is an **optional**
integration template with a `runLaneTests` step — replaceable by any CI system that can run npm.

## AI-assisted authoring (optional)

The repo carries an agent/skill layer for AI-assisted test *authoring* — Claude Code skills and
agents under [`.claude/`](.claude/), Copilot mirrors under [`.github/`](.github/), MCP wiring for
Playwright and an authoring-only screen-introspection server, and a curated memory system under
[`docs/memory/`](docs/memory/). Entry point for any agent: [`AGENTS.md`](AGENTS.md).

None of this is required to run tests. The no-runtime-AI source-pattern gate plus code review
guard the authoring/runtime boundary — the gate is a policy heuristic, not a reachability proof.

## Repository layout

| Path | What it is |
|---|---|
| `packages/*` | The 10 `@multilane/*` engine packages (npm workspaces) |
| `examples/consumer-smoke/` | Dogfood consumer installing the packaged engine from tarballs |
| `scripts/` | Gate runners + the dogfood harness |
| `docs/` | Architecture, API, strategy, coverage, traceability, curated memory |
| `orchestration/` | Robot Framework orchestration pattern (template) |
| `ci/` | Optional Jenkins shared-library template |
| `.claude/`, `.github/` | Authoring-time agent/skill layer (Claude source of truth, Copilot mirror) |
| `pyproject.toml`, `src/` | Python screen-driver package (stub) |
| `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `BOOTSTRAP_PROMPT.md` | Design + build-out docs |

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Before opening a PR run `npm run validate`. Community
standards: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md); questions: [`SUPPORT.md`](SUPPORT.md).

## License

**No license has been selected yet** — the packages are marked `UNLICENSED` and all rights are
reserved until the maintainers make an explicit licensing decision. Until then you may read and
evaluate the code, but redistribution or production use is not granted.
