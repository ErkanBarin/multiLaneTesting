# Onboarding — adopting `multilanetesting` in your team

This guide takes a team from zero to a passing first test against **your own system**, using this
repository as a shared engine. It assumes nothing about your organization — any team with a system
under test and a CI runner can follow it.

**Who this is for.** Teams that own a system exposing one or more testable surfaces — a browser
UI, an HTTP API, STOMP/WebSocket streams, a screen-only UI (VNC/RDP, C++ HMI, COTS application
with no DOM), or SNMP/trap surfaces — and want deterministic automated tests. AI may help *write* tests; it is never in
the loop when tests *run*.

**The model.** Two repositories, clearly separated:

| Repo | Owned by | Contains |
|---|---|---|
| The engine (this repo) | shared / maintainers | `@erkanbarin/*` packages, gates, scaffolder, docs |
| Your consumer project | your team | your specs, your locators, your `.env`, your CI job |

Your system's tests never live in the engine repo. You scaffold a small consumer project, install
the engine packages into it from npm, and write specs there. Engine updates arrive as normal
package upgrades. You do not need to clone this repository unless you want to change the engine.

The engine is [MIT-licensed](../LICENSE) and shared as a reference implementation — no support or
warranty commitment is made.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | `node --version`; 20.19+, 22.13+ or 24+ avoids dev-tool engine warnings |
| npm | 10.x or 11.x | bundled with Node |
| Git | any | access to your team's git host for the consumer project |
| Python | ≥ 3.11 | **only** if you build the screen-driver lane |
| Claude Code or GitHub Copilot | current | **only** for optional AI-assisted authoring (Step 6) |

Linux and macOS are the tested platforms; on Windows use WSL. The tarball installer (engine-clone
workflow) is POSIX-only.

---

## Step 1 — Check your toolchain

```bash
node --version       # v20 or later
npm --version        # 10 or 11
npm view @erkanbarin/cli version   # proves npm can reach the public registry
```

If the last command hangs or times out, your network blocks the npm registry — configure npm's
`proxy`/`https-proxy`, or `registry` for an internal mirror, before continuing.

---

## Step 2 — Scaffold your team's test project

Pick your lanes from what your system actually exposes — build only those:

| Your system has… | Lane | What a spec asserts |
|---|---|---|
| A browser/DOM UI | `web` | User flows via Playwright + selector factories |
| REST/HTTP endpoints | `http` | Status/shape/header contracts (passive GETs) |
| STOMP/WebSocket streams | `stomp` | Message shape (passive SUBSCRIBE; SEND is double-gated) |
| A screen-only UI (VNC/RDP, COTS) | `screen` | Frozen-locator replay + functional/golden/OCR oracles |
| An SNMP agent | `snmp` | Emulated GET/WALK; passive live checks require approved access |
| SNMP notifications | `trap` | Receive and decode a locally emitted trap |

```bash
npx @erkanbarin/cli new my-system --lanes web,http   # names are lowercase [a-z0-9-]
cd my-system
npm install                          # installs the pinned @erkanbarin/* packages; commit the lockfile
npm run verify                       # the deterministic gates, now in YOUR project
```

`mlt new` writes a config skeleton, a `locators/` dir, one example spec per lane under
`tests/<lane>/`, a `.env.example`, and an optional thin `Jenkinsfile`. Commit `package-lock.json`
so CI can run `npm ci`.

Working from an engine clone with unreleased changes? Run
`node <engine-repo>/packages/cli/bin/mlt.mjs new …` and then
`node <engine-repo>/scripts/install-tarballs.mjs my-system` instead of `npm install` — it packs the
engine into `my-system/vendor/multilane/` (commit that folder too). It rejects project paths
containing `#`, `%`, `\`, or `:`.

Put `my-system/` in your team's own git repository.

---

## Step 3 — Configure your environment

All target values come from the environment. Copy the template and fill in only what applies:

```bash
cp .env.example .env      # .env is gitignored — it never reaches the remote
set -a; . ./.env; set +a  # nothing loads .env automatically — export it into your shell
```

In CI, inject the same variables from your credential store instead of a file.

| Variable | What it is |
|---|---|
| `MULTILANE_WEB_BASE_URL` | Base URL if the target has a web UI |
| `MULTILANE_TARGET_HOST` | Host for API contract calls |
| `MULTILANE_WS_URL` | STOMP/WebSocket endpoint |
| `SCREEN_TARGET_HOST` | VNC/RDP host for the screen-driver lane |
| `SCREEN_RPS_PARTITION` | Test partition — e.g. `TEST_A`. **Never `PROD`** — the lane refuses to run. |
| `MULTILANE_SNMP_HOST` | Optional approved live SNMP target; the initial example uses an emulator |
| `MULTILANE_TRAP_PORT` | Optional port for a trap listener; the initial example uses loopback |

**No host literals in committed files, ever** — env-var names only. This is what makes the same
specs portable across your dev/test/CI environments.

---

## Step 4 — Write your first spec

The scaffold ships one example spec per lane under `tests/<lane>/` — copy the pattern:

```bash
npm run verify            # gates must stay green
npm run test:<lane>       # run each selected lane (web lane: npx playwright install chromium)
```

An example spec **skips** (exit 0, reason printed) when its target variable is unset — so a green
run is not proof a test executed. Check the output for `skipped` before trusting it.

Determinism rules that apply to every spec you write:

- Assert **functional truth** (state/objects), not screenshots alone.
- No sleeps — wait on conditions. No retry-until-green loops.
- Run every new spec **twice**; identical results required.
- Screen lane: only frozen, reviewed locators from `locators/<area>/` — discovery happens at
  authoring time, never during a run.

Background reading: [test strategy](test-strategy.md), [public API](API.md),
[architecture](../ARCHITECTURE.md).

---

## Step 5 — Wire up your CI

Any CI system that can run npm works:

```
npm ci
npx --no-install mlt verify      # deterministic gates — fail fast
npm run test:<lane>              # each selected lane; archive JUnit/HTML evidence
```

The scaffold includes an optional thin `Jenkinsfile`; a Jenkins shared-library template lives in
the engine repo under [`ci/jenkins-shared-library/`](../ci/jenkins-shared-library/). Inject
secrets and hosts from your CI credential store — never commit them.

---

## Step 6 (optional) — AI-assisted authoring

AI helps you *write* specs faster; the no-runtime-AI gate keeps it out of every run.

```bash
npm install -D @erkanbarin/authoring-web @erkanbarin/authoring-http   # one per lane you use
npx --no-install mlt authoring install --lanes web,http              # materialize skills/agents
```

- **Claude Code:** run `claude` in your consumer project.
- **GitHub Copilot:** the committed `.github/` mirrors are picked up automatically.

`mlt authoring check` detects drift; `mlt authoring update` re-materializes assets after an engine
update.

---

## Adapting the framework to your needs

- **Lanes are independent** — an `http`-only project pulls no Playwright or STOMP dependencies.
  Add a lane later with `mlt new`'s scaffold as reference, or re-scaffold and copy your specs in.
- **Scaffold templates** live in `packages/cli/src/scaffold.mjs`; authoring assets in
  `packages/authoring-*/assets/`. Fork-and-adjust is expected — the engine is a reference
  implementation.
- **Gates are configurable** — `multilane.config.json` controls which trees the no-runtime-AI gate
  scans; keep it pointed at all your runtime code (a zero-file scan fails by design).
- **Screen lane** — the authoring flow (introspect → propose → freeze → review) is documented in
  [ARCHITECTURE.md](../ARCHITECTURE.md); frozen locators are reviewed like code.
- **Improvements welcome** — upstream fixes and new lanes via PRs, see
  [CONTRIBUTING.md](../CONTRIBUTING.md).

## Extending the engine itself

Building a new lane or driver rather than consuming the engine? Clone the repo, run `npm ci` and
`npm run validate` (must be green), and use `npm run dogfood` to prove the packaged engine still
installs into example consumers. Then start from
[`BOOTSTRAP_PROMPT.md`](../BOOTSTRAP_PROMPT.md) — the build-out doc — and keep
`npm run validate` green.

## Guardrails (non-negotiable)

- **No host literals or secrets in committed files** — env-var names only.
- **No AI in a test run** — `npm run check:no-runtime-ai` must stay green (a source-pattern gate
  backed by code review).
- **Screen specs replay into a test partition** — never `PROD`.
- **Functional truth is the gate** — golden-image/OCR corroborate, they don't decide.
- **Run every new spec twice** — identical functional readback required.

## Getting help

Questions: [SUPPORT.md](../SUPPORT.md). Bugs: GitHub issues. Security: [SECURITY.md](../SECURITY.md)
— never a public issue.
