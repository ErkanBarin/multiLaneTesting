# Feature index — `multilanetesting`

Domain concepts an agent needs to author/validate specs: oracles, partitions, status semantics, and
the deterministic world.

## Oracles (assert in this order of authority)

| Oracle | Source | Role |
|---|---|---|
| **Functional truth** | object/state channel (socket / control tree) | **The gate** — pass/fail decision |
| **Rendering truth** | golden-image diff (Playwright `toHaveScreenshot` / BackstopJS) | Corroboration; mask volatile regions |
| **Legibility truth** | offline OCR (Tesseract / PaddleOCR) | Text presence/readability |

A spec **must** assert functional truth. Rendering/legibility only corroborate — never the sole pass.

## Deterministic world

- **RPS** (Recording & Playback System) replays a recorded scenario into a **test partition**.
- **Partitions:** `TEST_A`, `TEST_B`, `TEST_C` are test partitions. **`PROD` is operational — never target it.**
- **Functional-test harness / RPS** — if the target already has one, reuse its introspection socket and scenario metadata (see `ARCHITECTURE.md §4`).

## Driver tiers (how a locator resolves)

1. Object introspection (socket / control tree) — preferred.
2. Image template (DPI/resolution/theme-stamped) — when no object model.
3. Vision (local CV, authoring only) — OpenCV region proposals + offline OCR (PaddleOCR/EasyOCR) to discover a Tier-1/2 locator.
4. Supervised heal — AI proposes a re-pin for **human approval** (drift only).

## Status semantics (example — replace with real target states)

| State | Meaning |
|---|---|
| <!-- example --> `accepted` | object channel reports the area committed |
| <!-- example --> `pending` | submitted, not yet acknowledged |
| <!-- example --> `rejected` | validation failed at the object channel |

## Lanes

All lanes are first-class. Build the ones that match the target system's surfaces (confirmed in the
Phase 0 memo). **Web/DOM** (Playwright), **API contract** (passive HTTP), **WS contract** (passive
STOMP + supervised active SEND), **Screen driver** (no-DOM targets, deterministic replay).

## Lane authoring toolkits

`@multilane/authoring-{web,http,stomp}` ship a `lane.manifest.json` + skill/agent assets, installed
into consumer repos via `mlt authoring install` (one shared root-level copy per lane, deterministic
provenance in `.multilane/authoring.lock.json`). `screen` is the only lane without an authoring
package (`PLANNED_AUTHORING_LANES`). Committed at `7919f8d` (2026-07-14) — see
`LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md`. Source: `packages/cli/src/authoring/registry.mjs`.
