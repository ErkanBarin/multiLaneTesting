# Jenkins pipeline — `multilanetesting`

Conceptual CI pipeline (not active until the framework has real specs and a CI display host). Mirrors
the web application Jenkins shape with screen-specific additions.

## Stages

1. **Checkout** — this repo (and the sibling `multilanetesting-robot` if using the Robot wrapper).
2. **Setup** — install JS deps (`npm ci`), Python driver deps (`pip install -e .` / `uv sync`), and
   start the display stack (Xvfb + the VNC/RDP bridge) for headless screen runs.
3. **Guard** — `npm run check:no-runtime-ai` (no vision/computer-use reachable at runtime) and
   `npm run check:robot-contract` (tag consistency). **Fail fast** if either trips.
4. **Typecheck + lint** — `npm run typecheck`, `npm run lint`.
5. **Run** — replay specs into a **test partition** (never `PROD`). Each spec runs **twice**; identical
   functional readback required.
6. **Publish** — archive JUnit + HTML + golden-diff artifacts; optionally push to a test-management
   system (requirements system/Jira/STR adapter).

## Pipeline guardrails

- The display host is an **isolated VM/container**. No secrets reach any model (there is no model in the
  run path anyway).
- Host/partition values come from CI **credentials/env**, never from committed files.
- **Do not** enable any "bypass approvals"/autopilot mode on agents that could touch active WS SEND.
- GPU is **not** required — runtime is deterministic replay. A GPU is only relevant to the optional,
  offline authoring step (vision discovery), which never runs in CI.

## Cost guard

A CI check asserts **zero** vision/computer-use API calls during a run. If the count is non-zero, the
build fails — this is the mechanism that keeps per-run AI cost at zero.

> This file documents the intended **test/replay** pipeline (screen + lanes), which is conceptual
> until the framework has real specs and a CI display host. A publish pipeline can be attached in
> your CI; this repo ships only templates (`ci/`). Provision Node however your CI does (container
> image, tool installer, or nvm). For publishing guidance, see
> [`AGENTS.md` → "Publishing workflow"](../../AGENTS.md#publishing-workflow).
