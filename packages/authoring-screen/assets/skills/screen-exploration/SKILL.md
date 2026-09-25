---
name: screen-exploration
description: Explore a screen-only target (VNC/RDP, C++ HMI, COTS) to discover controls and freeze stable Tier-1/Tier-2 locators. Uses object-introspection socket and native UI automation/control tree first; local template matching + offline OCR only to discover a locator to freeze. Authoring-only — produces frozen locators, never a runtime path.
user-invocable: true
---

# screen-exploration

Discover **how to locate controls** on a screen target and **freeze** them for the author.

## Procedure

1. **Stand up an isolated session.** Xvfb + Docker or a dedicated VM; VNC/RDP in
   (`screen_driver_open_viewer`). Replay a recorded
   **RPS scenario** into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`) — never `PROD`. The target host and
   partition come from `SCREEN_TARGET_HOST` and `SCREEN_RPS_PARTITION`; no host literals.
2. **Try Tier 1 first (object introspection).**
   - App inspection socket (the target's C++ object/label channel) → symbolic object id.
   - Native UI automation/control tree (pywinauto/MS UI Automation on Windows, AT-SPI on Linux, Java Access Bridge) → role + name path.
3. **Tier 2 only if no object model.** Cut a template with `screen_driver_capture_template`, which
   proves it matches in exactly one place, and **stamp DPI/resolution/theme** on the freeze.
4. **Tier 3 only to discover a Tier-1/2 locator.** Offline OCR word boxes (`screen_driver_framebuffer`
   `ocr`) show where a labelled control is; you convert that into a Tier-1/2 freeze.
   Discovery output is never the runtime locator.
5. **Verify determinism.** Resolve the candidate **twice**; require identical results.
6. **Propose the freeze.** Record tier, resolver key, and a `requirement_ref` under `locators/<area>/`
   and in this project's own frozen-locator inventory. Note any blocker in this project's blocker log.

## Freeze record (what to store)

| Field | Example |
|---|---|
| `area` | `status` |
| `name` | `createButton` |
| `tier` | `1` (object socket) / `2` (template) |
| `resolver` | object id `app.status.create` / template `create.png` @1920×1080 @100% dark |
| `requirement_ref` | the id from this project's traceability record — never invented |
| `verified` | `YYYY-MM-DD`, resolved 2× identical |

## Guardrails

- Prefer Tier 1; Tier 2 must be theme/DPI-stamped; Tier 3 is authoring-only.
- Discovery runs **locally and offline** (template matching + OCR) — never send secrets, operational data, or raw
  screen content to any external model/vision API.
- Never freeze a locator you could not resolve deterministically.
- Env-var names only — no host literals.
- Never explore against `PROD`. `SCREEN_RPS_PARTITION` must be a test partition (`TEST_A`/`TEST_B`/`TEST_C`).

## Handoff

Hand the frozen-locator set to **screen-test-designer** (`screen-test-implementation`).
