# multilanetesting

A deterministic **multi-lane testing framework** for systems that expose more than one testable
surface — browser DOM, HTTP APIs, STOMP/WebSocket streams, screen-only UIs (VNC/RDP, framebuffer,
COTS applications with no DOM), SNMP agents, and trap receivers.

**Core principle: AI may assist at authoring time; test execution is always deterministic.** AI can
help discover screen locators or draft specs, but every artifact that runs in CI is frozen,
reviewed, and replayed with no model in the loop — checked by a source-pattern gate and code review
(a policy heuristic, not a reachability proof).

This is a **reference implementation under active development**, shared as a working sample — see
[Status and maturity](#status-and-maturity) and [License](#license).

## How you use it

This repo is the **engine**. Your tests never live here. You clone the engine once, then scaffold a
small **consumer project** for your own system and keep that in your own git repository:

| Repo | Contains |
|---|---|
| The engine (this repo) | `@multilane/*` packages, gates, scaffolder (`mlt`), docs |
| Your consumer project | Your specs, frozen locators, `.env`, CI job |

Engine updates reach your project by re-running the installer — adoption is a scaffold, not a fork.

## The six lanes

Pick only the lanes your system exposes — each is an independent package.

| Lane | Surface | How it verifies |
|---|---|---|
| `web` | Browser UI | Playwright + declarative selector factories |
| `http` | REST/HTTP | Passive GET + status/shape/header assertions |
| `stomp` | STOMP/WebSocket | Passive SUBSCRIBE; active SEND requires opt-in **and** host allowlist |
| `screen` | No-DOM UIs (VNC/RDP, C++ HMI, COTS) | Frozen Tier-1/2 locators replayed deterministically |
| `snmp` | SNMP agents | Emulated GET/WALK and optional passive contracts |
| `trap` | SNMP notifications | Receive and assert decoded traps |

The screen lane is the novel part: AI-assisted discovery (object introspection, local CV, offline
OCR) happens at **authoring time** and produces a frozen locator JSON under
`locators/<area>/<key>.json`, reviewed like code. At runtime the driver only replays frozen locators
— and refuses to run if the target partition resolves to `PROD`. Terms like *tier*, *oracle*, and
*partition* are defined in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | `>=20` (20.19+, 22.13+ or 24+ avoids dev-tool engine warnings) | everything |
| npm | 10 or 11 | everything |
| Python | `>=3.11` | **only** the `screen` lane's driver |

POSIX shell (Linux/macOS); on Windows use WSL. No target system or credentials are needed to try it.

## Quick start — test your own system

```bash
# 1. Get the engine and check it is healthy
git clone https://github.com/ErkanBarin/multiLaneTesting.git
cd multiLaneTesting
npm ci
npm run validate          # gates + typecheck + lint + unit tests — must be green

# 2. Scaffold your project next to the engine clone (name: lowercase [a-z0-9-])
cd ..
node multiLaneTesting/packages/cli/bin/mlt.mjs new my-system --lanes http   # e.g. --lanes web,http
node multiLaneTesting/scripts/install-tarballs.mjs my-system

# 3. Check the gates, then run a lane against your target
cd my-system
npm run verify            # deterministic gates only — does not run tests
MULTILANE_TARGET_HOST=https://your-api.example npm run test:http
```

What happens:

- `mlt new` writes a consumer project with a config skeleton, a `locators/` dir, **one example spec
  per lane** under `tests/<lane>/`, a `.env.example`, a registry-agnostic `.npmrc` template, and an
  optional thin `Jenkinsfile`. `mlt create-system` does the same **and** installs the optional
  AI-authoring assets (see [below](#ai-assisted-authoring-optional)). Run `mlt --help` for all
  commands.
- The `@multilane/*` packages are **not on any public registry**. `install-tarballs.mjs` packs the
  engine into `my-system/vendor/multilane/`, points the dependencies at those tarballs, and runs
  the first `npm install`. Commit `package-lock.json` **and** `vendor/multilane/` so your CI can run
  `npm ci` without the engine clone.
- Example specs **skip** (not fail) until their target variable is set — a green `verify` means the
  gates pass, not that a test ran. Nothing reads `.env` automatically: export the variables, or
  `cp .env.example .env`, fill it in, and load it with `set -a; . ./.env; set +a`.

Target values always come from the environment — **no host literals in committed files**:

| Variable | Lane |
|---|---|
| `MULTILANE_WEB_BASE_URL` | web |
| `MULTILANE_TARGET_HOST` | http |
| `MULTILANE_WS_URL` | stomp |
| `SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION` (never `PROD`) | screen |
| `MULTILANE_SNMP_HOST`, `MULTILANE_TRAP_PORT` | snmp, trap (optional; examples use a local emulator) |

Next: **[`docs/onboarding.md`](docs/onboarding.md)** — environment setup, writing specs, CI wiring,
and adapting the framework, step by step.

### Troubleshooting

- **`npm install` hangs with no output** — usually a proxy blocking the npm registry. Configure npm
  for your network (`npm config set proxy …` / `https-proxy …`, or `registry` for an internal
  mirror); the `http`-only lane needs the fewest downloads.
- **Web lane** — install a browser once: `npx playwright install chromium`.
- **Installer rejects the path** — project paths must not contain `#`, `%`, `\`, or `:`.

## Customize it

The engine is designed to be modified — different lanes, adjusted scaffold templates, your own
authoring assets. Start at [`CUSTOMIZATION_MAP.md`](CUSTOMIZATION_MAP.md) and
[Adapting the framework](docs/onboarding.md#adapting-the-framework-to-your-needs). Public API:
[`docs/API.md`](docs/API.md).

## AI-assisted authoring (optional)

Claude Code skills/agents under [`.claude/`](.claude/), Copilot mirrors under [`.github/`](.github/),
MCP wiring for Playwright and an authoring-only screen-introspection server. Entry point for any
agent: [`AGENTS.md`](AGENTS.md). In your consumer project:

```bash
npx --no-install mlt authoring install --lanes web,http   # materialize skills/agents for your lanes
```

None of this is required to run tests. The no-runtime-AI gate keeps models out of every run.

## Guardrails

- **No AI at runtime** — `npm run check:no-runtime-ai` fails the build when a forbidden pattern
  matches runtime sources (a source-pattern heuristic backed by code review).
- **No host literals or secrets in the repo** — env-var references only; `.env` is gitignored.
- **Read-only by default** — HTTP only GETs, STOMP only subscribes; SEND needs an explicit flag
  **and** an allowlisted host.
- **Operational-partition refusal** — the screen lane throws if `SCREEN_RPS_PARTITION` is `PROD`.
- **Pinned supply chain** — committed lockfile, exact versions, SHA-pinned Actions, Dependabot.

Threat model and reporting: [`SECURITY.md`](SECURITY.md).

## Working on the engine itself

```bash
npm run validate     # no-runtime-AI gate + robot-contract gate + typecheck + lint + unit tests
npm run dogfood      # packs all 16 workspaces, installs them into example consumers, smoke-tests them
```

`dogfood` proves the engine installs and runs from tarballs (it does not test any live target).
CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs both plus a Python driver smoke on
every pull request. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

| Path | What it is |
|---|---|
| `packages/*` | The 16 `@multilane/*` engine packages (npm workspaces) |
| `examples/consumer-smoke/` | Dogfood consumer installing the packaged engine from tarballs |
| `scripts/` | Gate runners, tarball installer, dogfood harness |
| `docs/` | Onboarding, API, strategy, coverage, traceability, curated memory |
| `orchestration/` | Robot Framework orchestration pattern (template) |
| `ci/` | Optional Jenkins shared-library template |
| `.claude/`, `.github/` | Authoring-time agent/skill layer |
| `pyproject.toml`, `src/`, `packages/screen/driver/` | Python screen driver |

## Status and maturity

| Component | Maturity | Notes |
|---|---|---|
| `@multilane/core` (config, gates, verify) | Working | Unit-tested; `mlt verify` runs the deterministic gates |
| `@multilane/cli` (`mlt new`, `create-system`, `verify`, `authoring`) | Working | Unit-tested; `create-system` exits nonzero if authoring packages are missing |
| `@multilane/http` | Working | Read-only GETs, shape checks, timeouts, body caps |
| `@multilane/stomp` | Working | Passive SUBSCRIBE; active SEND double-gated |
| `@multilane/screen` | Working | Loads/validates frozen locators; PROD-partition refusal |
| `@multilane/web`, `@multilane/playwright-config` | Working | Selector factories + shared Playwright preset |
| `@multilane/snmp-model`, `-runtime`, `-adapter-selection` | Working locally | Emulated agent/trap listener; local unit tests |
| `@multilane/authoring-*` (6 packages) | Working locally | Authoring-time assets only; never imported at runtime |
| Python screen driver | Tested locally | AT-SPI and framebuffer helpers; live-target behavior unverified |
| Robot orchestration (`orchestration/`) | **Template** | Documents a pattern; no runnable suites |
| Jenkins shared library (`ci/`) | **Optional template** | Not exercised by this repo's CI |

## License

This repository is shared as a working sample — a reference for how one team approaches
deterministic multi-lane testing. **It deliberately carries no license**: the packages are marked
`UNLICENSED`, no rights are formally granted, and no support, warranty, or maintenance commitment is
made. You are welcome to read it, evaluate it, and use it as a starting point for your own work; if
your use requires a formal grant, ask the repository owner.

Community: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) · [`SUPPORT.md`](SUPPORT.md) ·
[`CHANGELOG.md`](CHANGELOG.md)
