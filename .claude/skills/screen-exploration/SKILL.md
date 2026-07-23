---
name: screen-exploration
description: Explore a screen-only target (screen-only HMI, COTS, desktop application over VNC/RDP) to discover controls and freeze stable Tier-1/Tier-2 locators. Uses object-introspection socket and native UI automation/control tree first; local computer-vision (OpenCV) + offline OCR only to discover a locator to freeze. Authoring-only — produces frozen locators, never a runtime path.
user-invocable: true
---

# screen-exploration

Discover **how to locate controls** on a screen target and **freeze** them for the author.

## Procedure

1. **Stand up an isolated session.** Xvfb + Docker or a dedicated VM; VNC/RDP in. Replay a recorded
   **RPS scenario** into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`) — never `PROD`.
2. **Try Tier 1 first (object introspection).**
   - App inspection socket (e.g. screen-only HMI C++ object/label channel) → symbolic object id.
   - Native UI automation/control tree (pywinauto/MS UI Automation on Windows, AT-SPI on Linux, Java Access Bridge) → role + name path.
3. **Tier 2 only if no object model.** Capture a reference image, **stamp DPI/resolution/theme**,
   verify an OpenCV match resolves to a stable coordinate.
4. **Tier 3 only to discover a Tier-1/2 locator.** Local OpenCV region proposals + offline OCR
   (PaddleOCR/EasyOCR, all Apache-2.0) propose a candidate; you convert it into a Tier-1/2 freeze.
   Discovery output is never the runtime locator.
5. **Verify determinism.** Resolve the candidate **twice**; require identical results.
6. **Propose the freeze.** Record tier, resolver key, and a `requirement_ref` under `locators/<area>/`
   and in `docs/memory/selector-index.md`. Note any blocker in `docs/memory/blocker-index.md`.

## Freeze record (what to store)

| Field | Example |
|---|---|
| `area` | `sample-panel` |
| `name` | `createButton` |
| `tier` | `1` (object socket) / `2` (template) |
| `resolver` | object id `app.samplePanel.create` / template `create.png` @1920×1080 @100% dark |
| `requirement_ref` | `REQ_001` |
| `verified` | `YYYY-MM-DD`, resolved 2× identical |

## Guardrails

- Prefer Tier 1; Tier 2 must be theme/DPI-stamped; Tier 3 is authoring-only.
- Discovery runs **locally and offline** (OpenCV + OCR) — never send secrets, operational data, or raw
  screen content to any external model/vision API.
- Never freeze a locator you could not resolve deterministically.
- Env-var names only — no host literals.

## Handoff

Hand the frozen-locator set to **screen-test-designer** (`screen-test-implementation`).
