---
name: screen-test-implementation
description: Implement a deterministic screen spec from a frozen-locator set. Replays an RPS scenario into a test partition, drives controls via frozen Tier-1/2 locators, asserts functional truth as the gate (corroborated by golden-image and OCR oracles), and emits JUnit/HTML evidence with a requirement_ref. No runtime AI.
user-invocable: true
---

# screen-test-implementation

Turn frozen locators into a **deterministic spec**. Runtime capability lives in `@multilane/screen`
(`loadFrozenLocator`, `assertFrozen`, `runDriver`, `openViewer`); this skill is the authoring-time
companion — it never runs as part of a test.

## Anatomy of a spec

1. **Fixture (deterministic world).** Load a recorded **RPS scenario**; replay into a **test
   partition** (`TEST_A`/`TEST_B`/`TEST_C`). Never `PROD`.
2. **Arrange.** Bring the target to the starting context using frozen locators only.
3. **Act.** Drive the control(s) via frozen Tier-1/2 locators: `atspi_bridge.py do_action`, or
   `framebuffer.py find` then `click`/`type`/`key` (a VNC/RDP target first goes through `openViewer`).
4. **Assert (oracles, in order of authority).**
   - **Functional truth** (object/state channel) — the **gate**.
   - **Rendering truth** (`framebuffer.py compare` against a golden) — corroboration; `--mask`
     volatile regions (clock, caret, AA).
   - **Legibility truth** (`framebuffer.py ocr`, offline) — text presence/readability where relevant.
5. **Evidence.** Emit JUnit + HTML; attach the functional readback and the screenshot. Carry a
   `requirement_ref`.

## Authoring style (BDD-like, no framework)

Tests read as a short user scenario with named steps:

```
test "user creates a restricted area"
  step "user opens the areas editor"          # arrange via frozen locators + RPS scenario
  step "user submits a new area"              # act
  step "user sees the area accepted"          # assert functional truth + golden image
```

- Steps name **intent and outcome**, not mechanics (no `click`, `coordinate`, `template`, `socket`).
- One spec = one user-observable behavior. Group related assertions into one outcome step.
- No sleeps — wait on the object/state channel. No host literals — env-var names only.

## Hard rules

- Resolve **only** via frozen Tier-1/2 locators. Missing/drifted → route to `screen-exploration`
  (new freeze) or `screen-flake-hardening` (drift). Never improvise a runtime template or a vision call.
- Functional truth is the gate — never downgrade to screenshot-only to pass.
- `SCREEN_RPS_PARTITION` must resolve to `TEST_A`, `TEST_B`, or `TEST_C`. **Never `PROD`** — that is the
  operational partition. `loadFrozenLocator` refuses outright when it resolves to `PROD`; treat that
  refusal as final, never as a configuration problem to route around.
- Run the spec **twice**; require identical functional readback before "done".
- `requirement_ref` values come from this project's traceability record — never invented.

## After implementation

Add or refresh the `locators/<area>/` entry, this project's frozen-locator inventory row, and its
coverage and traceability records.

## Coding style — ponytail (lazy-first)

When generating specs or helpers, climb this ladder and stop at the first rung that holds:

1. Does this need to exist? Speculative need → skip it, say so in one line. (YAGNI)
2. Already in this codebase? Reuse it — look before you write.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dep solves it? Use it.
6. Can it be one line? Write one line.
7. Only then: the minimum code that works.

Shortest working diff wins. No unrequested abstractions, no boilerplate "for later", deletion over
addition. Mark deliberate shortcuts: `# ponytail: <ceiling>, <upgrade-path>`.
