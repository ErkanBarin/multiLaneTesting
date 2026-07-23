# Implementation Plan — `multilanetesting`

The phased build plan for the **multi-lane testing framework**. A given system under test may
expose one or more surfaces (DOM, REST/HTTP, STOMP/WebSocket, screen-only VNC/RDP) — this plan
builds the lanes that match the surfaces present. An AI agent implements phases **in order**,
smallest useful slice first, gating on Phase 0. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`AGENTS.md`](AGENTS.md) before starting.

**Working principles (non-negotiable):**
- Build only the lanes the target system actually exposes — do not add a lane because it exists in
  the template.
- For the screen-driver lane: AI at authoring, never at runtime. Deterministic replay. Replay only
  into test partitions, never live/operational.
- No host literals in committed files — env-var names only. No secrets to any model.

---

## Phase map

| Phase | Goal | Approval ask? | Exit gate |
|---|---|---|---|
| **0** | Target analysis & lane selection | **Yes — the only one** | Surface inventory + lane-selection memo signed off |
| **1** | First lane MVP | No | One real spec/test passing on the easiest reachable surface |
| **2** | AI authoring + supervised self-heal (screen lane, if used) | No | `discover → freeze → review → replay` loop works end-to-end |
| **3** | Remaining lanes + CI orchestration + Robot wrapper | No | All applicable lanes pass; Robot runner produces one merged report |
| **4** | Package as a reusable starter-kit | No | A second system onboards from the template with no core edits |

---

## Phase 0 — Target analysis & lane selection (approval gate)

**Goal.** Understand the system under test well enough to choose lanes and confirm feasibility
before writing any test code.

**Do.**
1. Identify all testable surfaces the system exposes:
   - Does it have a **DOM/browser UI**? → web lane (Playwright).
   - Does it expose **REST/HTTP endpoints**? → api-contract lane.
   - Does it emit/accept **STOMP/WebSocket messages**? → ws-contract lane.
   - Does it render to a **screen with no DOM** (VNC/RDP, C++ HMI, COTS)? → screen-driver lane.
2. For each surface, assess feasibility:
   - DOM: can a Playwright selector reach the control?
   - API: is there a spec (OpenAPI) or discoverable endpoint list?
   - WS: what destinations exist? is a test partition reachable for active SEND?
   - Screen: is there an object/state channel (socket, control tree)? if not, is an image template viable?
3. Choose the **first lane** (simplest reachable surface) and the others in priority order.
4. Write the **1–2 page memo**: system name, surfaces found, lanes selected in order, feasibility
   verdict per surface, any blockers (record in `docs/memory/blocker-index.md`).

**Deliverables.**
- Lane-selection memo (surfaces × feasibility table + recommended build order).
- `docs/memory/route-map.md` seeded with the target's surfaces and status.
- `docs/memory/blocker-index.md` entries for anything not immediately testable.

**Exit gate.** Stakeholder sign-off on the memo and lane order. **Do not start Phase 1 until this passes.**

**Files touched:** `docs/memory/*`, memo in `spikes/phase0-<target>/`.

---

## Phase 1 — First lane MVP

**Goal.** One real, passing spec on the easiest reachable surface selected in Phase 0. Establish
the repo skeleton (workspace, config, lint, typecheck, guard scripts) that all later lanes share.

**Decide which lane goes first (from the Phase 0 memo):**

| If the first surface is… | Start here |
|---|---|
| DOM / browser | Web lane — Playwright + selector factory |
| REST/HTTP API | API contract lane — passive shape test |
| STOMP/WebSocket | WS contract lane — passive SUBSCRIBE |
| Screen-only (VNC/RDP, C++ HMI, COTS) | Screen-driver lane — see sub-steps below |

### Web lane MVP (Playwright)
1. Set up `tests/web/` workspace with `@playwright/test`, `tsconfig`, eslint, `.env` wiring.
2. Add a selector factory (`selectors/<area>.ts`) with one named `Locator`.
3. Write one `test()` with `test.step()` blocks in user-intent style.
4. Verify it runs headless and passes; no sleeps, no host literals.

### API contract lane MVP
1. Set up `tests/http/` workspace with `tsx`, `dotenv-cli`, env gate `MULTILANE_API_CONTRACT=1`.
2. Write one passive GET test asserting response shape and status — no state mutation.
3. Verify it runs and passes; drive the host from `MULTILANE_TARGET_HOST`.

### WS contract lane MVP
1. Set up `tests/stomp/` workspace with `@stomp/stompjs`, `ws`, env gate `MULTILANE_WS_CONTRACT=1`.
2. Write one passive SUBSCRIBE test asserting message shape.
3. Active SEND requires a second opt-in flag `MULTILANE_WS_INJECT=1` and an approved-host preflight.

### Screen-driver lane MVP
1. Stand up an isolated display (Xvfb + Docker or dedicated VM) with VNC/RDP access.
2. Replay a recorded RPS scenario into a **test partition** (never live/operational).
3. Implement the driver core: Tier-1 locator resolver (object socket / control tree), input synth (PyAutoGUI), capture.
4. Implement the three oracles: functional (socket, the gate), rendering (golden-image diff), legibility (offline OCR).
5. Write one spec: one control driven, functional truth asserted, evidence emitted.

**Deliverables (all lanes).**
- The workspace(s) for the first lane, wired into root `package.json`.
- One passing spec with JUnit + HTML evidence and a `requirement_ref`.
- Traceability row in `docs/traceability.md`; `docs/memory/selector-index.md` or `route-map.md` updated.

**Exit gate.** The spec passes twice; no host literals; `typecheck` and `lint` pass.

---

## Phase 2 — AI authoring + supervised self-heal

**Goal.** Make authoring fast and healing safe — *without* introducing runtime AI.

**Do.**
1. Build the **`screen-explorer`** agent: explores a live screen via local CV (OpenCV region
   proposals + offline OCR, Apache-2.0), proposes Tier-1/2 locators to freeze. **Authoring only.**
2. Build the **`screen-test-designer`** agent: turns a frozen-locator set into a spec in repo style.
3. Implement the **`discover → freeze → review → replay`** loop. Every freeze is human-reviewed
   before it can be replayed.
4. Build **supervised heal** (Tier 4): when a frozen locator stops resolving, the agent proposes a
   re-pin for human approval; it never re-pins silently.
5. Enforce the **no-runtime-AI** rule in CI (fail the build if a vision/computer-use call is reachable
   from a test run).

**Deliverables.**
- `.claude/agents/screen-explorer.md`, `screen-test-designer.md`, `screen-flake-debugger.md` (filled).
- `tools/freeze/` (locator-freeze CLI), `tools/heal/` (supervised re-pin), CI guard `check:no-runtime-ai`.
- Updated `docs/memory/selector-index.md` (frozen-locator inventory) and `agent-query-guide.md`.

**Exit gate.** A new screen is authored end-to-end through the loop; a deliberately-drifted locator
is healed via supervised re-pin; CI blocks any runtime AI path.

---

## Phase 3 — Remaining lanes + CI orchestration + Robot wrapper

**Goal.** Multi-lane parity across all applicable lanes, orchestrated and reported as one.

**Do.**
1. Add **web** (Playwright DOM), **api-contract** (passive HTTP), **ws-contract** (passive STOMP +
   supervised active-SEND) lanes as npm workspaces, each env-gated.
2. Stand up the **Robot orchestrator** (`multilanetesting-robot` sibling): thin Robot wrapper that shells
   out to each lane's runner, three granularity levels (Lane / Area / Tag), tag contract + guard.
3. Wire the **Jenkins pipeline** (two sibling checkouts, setup, run, archive, `rebot --merge`).

**Deliverables.**
- `tests/web/`, `tests/http/`, `tests/stomp/` lane specs.
- `orchestration/` Robot suites + process resource file; `docs/ci/robot-orchestration.md`.
- `Jenkinsfile`; merged HTML/JUnit report.

**Exit gate.** `./bin/run.sh suites/lanes.robot` runs every enabled lane and produces one merged report.

---

## Phase 4 — Package as a reusable starter-kit

**Goal.** Make onboarding a *second* target a template operation, not a rebuild.

**Do.**
1. Extract target-specific config into a `targets/<name>/` profile (channel, partition, theme/DPI).
2. Sweep core docs, skills, and agent files for deployment-specific vocabulary (system names,
   partition schemes, origin-repo references) — genericize or move it behind the target profile so
   the core template reads team-agnostic.
3. Provide a `create-multilanetesting`-style scaffolder (or a documented copy-and-fill flow).
4. Document the full onboarding in `docs/onboarding.md` and update the memory indices.

**Deliverables.**
- `targets/<name>/` profile schema + one example; scaffolder or onboarding doc.
- A second target stood up using only the template (no edits to `src/driver` or `src/oracles`).

**Exit gate.** A second target onboards with config-only changes.

> **Status note (2026-07-07):** this exit gate is realized, but by a different, since-adopted shape
> than the sketch above — the engine publishes as versioned `@multilane/*` npm packages (`packages/*`
> in this repo), and "a second target" is a `systems/<name>/` project in an external **estate repo**
> scaffolded via `mlt new` and consuming the published packages, not an in-repo `targets/<name>/`
> profile. Three such systems are stood up and verified offline (scaffold, cwd-scoped isolation,
> `mlt verify` gates). The file map below (`src/driver`, `tools/freeze`, `targets/`) reflects the
> original single-repo sketch, superseded by the `packages/*` engine + external estate pattern —
> read `README.md`'s "Real-world consumers" section for the current shape.

---

## File map the agent should produce (by end of Phase 3)

> **Status note:** this file map is the original design sketch and is superseded by the `packages/*`
> engine + estate-repo shape. The paths below do not exist in this repository.

```
multilanetesting/
  AGENTS.md  CLAUDE.md(local)  .github/  .claude/  docs/
  src/
    driver/        locator resolver (Tier 1→2), input synth, capture
    oracles/       functional, rendering, legibility
    fixtures/      RPS scenario loader
  locators/        frozen Tier-1/2 locators per area
  tests/           screen specs per area
  tools/
    freeze/        authoring-time locator freeze CLI
    heal/          supervised re-pin
  targets/         per-target config profiles (Phase 4)
  tests/           web / http / stomp / screen lane specs (Phase 3)
  orchestration/   Robot wrapper (multilanetesting-robot)
  artifacts/       evidence (JUnit, HTML, screenshots)
  spikes/          Phase 0 spike output
  package.json  pyproject.toml  Jenkinsfile  .env.example  .gitignore
```

---

## Definition of done (per spec)

- Resolves via Tier 1 (or Tier 2 with a pinned, theme/DPI-stamped template) — **no runtime AI**.
- Replays a recorded RPS scenario into a **test partition**, never `PROD`.
- Asserts **functional truth** as the gate; rendering/legibility as corroboration.
- Emits JUnit + HTML evidence with a `requirement_ref`.
- Adds/updates the relevant `docs/memory/*` index and `docs/traceability.md` row.
- Passes the pr-hygiene checklist (`.claude/skills/pr-hygiene`).
