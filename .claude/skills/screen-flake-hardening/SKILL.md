---
name: screen-flake-hardening
description: Diagnose and fix flaky or drifted screen specs without weakening assertions or adding runtime AI. Classifies the failure (locator drift, synchronization, non-deterministic fixture, rendering-oracle noise, or real defect) and applies the matching fix, including supervised Tier-4 re-pin for genuine drift.
user-invocable: true
---

# screen-flake-hardening

Make a flaky screen spec deterministic again. The screen analog of web application's `webapp-flake-hardening`.

## Diagnose before editing

| Symptom | Likely cause | Fix |
|---|---|---|
| Locator no longer resolves | Tier-1 id renamed / Tier-2 template fails on new DPI/theme | **Supervised Tier-4 re-pin** (human-approved) |
| Intermittent miss right after an action | Acted before the object channel settled | Wait on the **object/state channel**, never `sleep` |
| Passes locally, fails in CI | Wrong partition or live `PROD` data leaked in | Fix the **RPS scenario / partition** |
| Golden-image diff flaps | Anti-aliasing / clock / cursor pixels | **Mask** the volatile region; keep functional truth as gate |
| Functional readback genuinely wrong | Real defect | Record a finding — not a flake |

## Procedure

1. Pull the run evidence: **functional-channel readback** + **golden-image diff** + logs.
2. Classify with the table above. Do **not** edit before classifying.
3. Apply the matching fix. For drift, propose a re-pin and **require human approval** before committing.
4. Re-run **twice**; require identical functional readback.
5. Record the root cause in `docs/memory/blocker-index.md` or `selector-index.md`.

## Never

- Add `sleep`/retry loops to mask a timing or determinism bug.
- Introduce a runtime vision/computer-use call to "find" the control.
- Re-pin silently or downgrade the functional oracle to a screenshot-only check.
