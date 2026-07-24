# Bootstrap Prompt — build `multilanetesting`

> **How to use this file.** Open this repo in your AI coding agent (Claude Code, GitHub
> Copilot, Cursor, Codex CLI, …) and paste the prompt below — or simply say *"Follow
> BOOTSTRAP_PROMPT.md."* The agent will read the plan, the architecture, and the templates already
> in this kit, then implement the framework phase-by-phase. Everything the agent needs is in this
> repository; it should not invent structure that contradicts these files.

---

## PROMPT (paste this to the agent)

You are implementing **`multilanetesting`**, a standalone deterministic **multi-lane testing
framework** for every surface the target system exposes: screen-only targets (C++ HMIs, COTS,
anything over VNC/RDP) via a deterministic screen driver, plus web/DOM (Playwright), API contract,
and WebSocket contract lanes. This repository already contains a complete starter kit. Your job is to build the
framework **according to the plan**, not to redesign it.

### Tool setup (optional authoring aids)

The following tools can speed up authoring work when the host supports them. They are development
tools only; neither may be reachable from a test run.

1. **Ponytail** (optional) — keeps implementations minimal (YAGNI ladder). Install in GitHub Copilot CLI:
  ```bash
  copilot plugin install DietrichGebert/ponytail
  ```
  If available, work in Ponytail's default `full` mode and choose the smallest safe implementation.
2. **Graphify** (optional) — turns the codebase into a queryable knowledge graph. Install with the
  preferred Python tool available on this machine:
  ```bash
  uv tool install graphifyy
  ```
  If `uv` is unavailable, run:
  ```bash
  python3 -m pip install --user graphifyy
  ```
  Use `/graphify` for codebase architecture and relationship questions when the host exposes the
  Graphify skill; otherwise use the installed `graphify` command directly.

### Read first (in this order)

1. `ARCHITECTURE.md` — driver tiers, three oracles, deterministic-replay model, building blocks, risks.
2. `AGENTS.md` — the cross-agent entrypoint and the memory/recall policy.
3. `docs/memory/README.md` — how the curated memory system works (store/recall/update).
4. `CUSTOMIZATION_MAP.md` — the Claude (source of truth) ↔ Copilot (wrapper) mirror.

### Non-negotiable rules

- **AI at authoring, never at runtime.** Local CV (OpenCV + offline OCR) may *discover and freeze*
  locators during authoring — fully offline, Apache-2.0/BSD-3-Clause. Test **runs replay frozen
  locators with no model in the loop.**
  Add a CI guard that fails if any vision/computer-use call is reachable from a test run.
- **Deterministic world.** Replay recorded RPS scenarios into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`).
  **Never `PROD`.**
- **Functional truth is the gate.** Assert pass/fail from the app's object/state channel. Golden-image
  and OCR are corroborating oracles, not substitutes.
- **No host literals in committed files.** Reference targets by env-var name (`SCREEN_TARGET_HOST`,
  `SCREEN_RPS_PARTITION`, …). The only place real values live is `.env` (gitignored).
- **No secrets to any model.** Never send credentials, PATs, `.env`, or operational data to a
  vision/computer-use API. Run authoring against an isolated VM.
- **Prefer Tier 1.** Resolve locators via the object socket or control tree first; image templates
  (Tier 2) only when no object model is reachable, and always stamp DPI/resolution/theme.
- **DOM targets stay on Playwright.** Do not reimplement DOM testing on the screen driver.
- **Curated memory, not transcripts.** Write only verified, reusable, route-changing facts to
  `docs/memory/*`. Never commit chat logs, secrets, or unverified assumptions.
- **Ponytail is active.** Apply its `full` YAGNI ladder to implementation work; do not add local
  copies of the plugin's skills or prompts.

### How to work

- **Smallest useful slice first.** One target, one action, one spec — then expand.
- **Gate on Phase 0.** Implement Phase 0 (target analysis & lane selection) and **stop for human
  sign-off** before Phase 1. The lane-selection memo is the only approval ask.
- **Use the agent workflow.** Discovery → authoring → validation maps to
  `screen-explorer → screen-test-designer → repo-keeper`; `screen-flake-debugger` enters on
  failure/drift. The skills in `.claude/skills/*` define *how*; `AGENTS.md` defines *when* to invoke.
- **Track progress.** Keep a todo list. Mark each phase's exit gate explicitly.
- **Update memory as you go.** After a discovery or implementation slice, run the `repo-keeper`
  memory-check and update the relevant `docs/memory/*` index (route/selector/blocker/feature) and
  `docs/traceability.md`.
- **Validate before claiming done.** Typecheck/lint the JS lanes, run the new spec twice for
  determinism, and pass the `pr-hygiene` checklist.

### Build order (summary)

1. **Phase 0 — Target analysis & lane selection** *(approval gate)*: inventory the target's testable
   surfaces, assess feasibility per surface, choose the lane order, write the memo. **Stop for sign-off.**
2. **Phase 1 — First lane MVP**: one real passing spec on the easiest reachable surface, plus the
   shared repo skeleton (workspace, config, lint, typecheck, guard scripts).
3. **Phase 2 — AI authoring + supervised heal** *(screen lane, if used)*: `screen-explorer` +
   `screen-test-designer` agents, the `discover → freeze → review → replay` loop, Tier-4 supervised
   re-pin, CI no-runtime-AI guard.
4. **Phase 3 — Remaining lanes + CI**: the other applicable lanes as workspaces, the Robot
   orchestrator (Lane/Area/Tag + tag-contract guard), Jenkins pipeline, merged report.
5. **Phase 4 — Reusable starter-kit**: extract `targets/<name>/` profiles, genericize
   deployment-specific vocabulary, prove a second target onboards with config-only changes.

### Definition of done (every spec)

Tier-1 (or pinned Tier-2) resolution, no runtime AI, RPS replay into a test partition (never `PROD`),
functional-truth gate, JUnit+HTML evidence with a `requirement_ref`, memory + traceability updated,
PR-hygiene checklist passed.

### When unsure

Ask one concise question rather than guessing on: which target to start with, which functional
channel exists, which partition is safe, or whether a control has an object/control-tree representation. Do
**not** silently fall back to image templates or runtime vision to "make it work."

---

## Optional: shorter kickoff

If you just want to start, paste this instead:

> Follow `BOOTSTRAP_PROMPT.md`. Read `ARCHITECTURE.md` and `AGENTS.md` first. Implement **Phase 0 only** (target analysis & lane selection for the target
> system described to you) and stop for my sign-off. Honor every non-negotiable rule — especially *AI at
> authoring, never at runtime* and *replay into a test partition, never PROD*. Keep a todo list and
> tell me what you need from me to run the spike.
