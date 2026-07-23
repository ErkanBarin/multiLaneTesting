---
name: screen-test-implementation
description: Implement a deterministic screen spec from a frozen-locator set, following multilanetesting conventions. Replays an RPS scenario into a test partition, drives controls via frozen Tier-1/2 locators, asserts functional truth as the gate (corroborated by golden-image and OCR oracles), and emits JUnit/HTML evidence with a requirement_ref. No runtime AI.
user-invocable: true
---

# screen-test-implementation

Turn frozen locators into a **deterministic spec** in repo style.

## Anatomy of a spec

1. **Fixture (deterministic world).** Load a recorded **RPS scenario**; replay into a **test
   partition** (`TEST_A`/`TEST_B`/`TEST_C`). Never `PROD`.
2. **Arrange.** Bring the target to the starting context using frozen locators only.
3. **Act.** Drive the control(s) via frozen Tier-1/2 locators + input synth (PyAutoGUI).
4. **Assert (oracles, in order of authority).**
   - **Functional truth** (object/state channel) — the **gate**.
   - **Rendering truth** (golden-image diff) — corroboration; mask volatile regions (clock, AA).
   - **Legibility truth** (offline OCR) — text presence/readability where relevant.
5. **Evidence.** Emit JUnit + HTML; attach the functional readback and the screenshot. Carry a
   `requirement_ref`.

## Authoring style (BDD-like, no framework)

Tests read as a short user scenario with named steps:

```
test "user creates a sample panel entry"
  step "user opens the sample panel editor"   # arrange via frozen locators + RPS scenario
  step "user submits a new entry"             # act
  step "user sees the entry accepted"         # assert functional truth + golden image
```

- Steps name **intent and outcome**, not mechanics (no `click`, `coordinate`, `template`, `socket`).
- One spec = one user-observable behavior. Group related assertions into one outcome step.
- No sleeps — wait on the object/state channel. No host literals — env-var names only.

## Hard rules

- Resolve **only** via frozen Tier-1/2 locators. Missing/drifted → route to `screen-exploration`
  (new freeze) or `screen-flake-hardening` (drift). Never improvise a runtime template or a vision call.
- Functional truth is the gate — never downgrade to screenshot-only to pass.
- Run the spec **twice**; require identical functional readback before "done".

## After implementation

Add/refresh the `locators/<area>/` entry, the `docs/memory/selector-index.md` row, the
`docs/coverage-map.md` cell, and the `docs/traceability.md` row. Then hand off to **repo-keeper**.
