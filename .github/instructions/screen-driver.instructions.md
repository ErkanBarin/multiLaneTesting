---
applyTo: "tests/screen/**,locators/**"
description: Path-scoped guidance for the screen-driver lane — deterministic black-box specs against screen-only targets (screen-only HMI, COTS, desktop application over VNC/RDP).
---

# Screen-driver lane

These rules apply to `tests/screen/**` and `locators/**`. Full context:
[`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`AGENTS.md`](../../AGENTS.md).

## Non-negotiable

- **AI at authoring only.** No vision, computer-use, or `screen-driver` discovery is reachable from a
  test run. `npm run check:no-runtime-ai` must pass.
- **Deterministic world.** Replay a recorded RPS scenario into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`)
  — **never `PROD`**.
- **Frozen locators only at runtime.** Resolve via Tier-1 (object socket / control tree) or Tier-2 (image
  template, DPI/resolution/theme-stamped). Missing/drifted → route to exploration or flake-hardening,
  never improvise.
- **Functional truth is the gate.** Assert the object/state channel; corroborate with golden-image
  (mask volatile regions) and offline OCR. Never downgrade to screenshot-only to pass.

## Conventions

- One spec per behavior in `tests/<area>/<feature>.spec`; steps name user intent (`user opens…`,
  `user sees…`), not mechanics (`click`, `coordinate`, `template`).
- No sleeps — wait on the object/state channel. No host literals — env-var names only
  (`SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION`).
- Every locator a spec uses is recorded under `locators/<area>/` and in
  `docs/memory/selector-index.md` with tier + "Last verified".
- Every spec carries a `requirement_ref` and a row in `docs/traceability.md`.
- Run a touched spec **twice**; require identical functional readback before "done".
