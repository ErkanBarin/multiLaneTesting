---
name: screen-operator
description: Route screen and browser work across the deterministic screen driver, the screen-driver MCP (authoring), local CV + offline OCR discovery (authoring only), and Playwright (DOM lane). Decides which surface to use for a given task so runtime stays deterministic and AI stays at authoring time.
user-invocable: true
---

# screen-operator

Pick the right surface for screen/browser work. The screen analog of web application's `playwright-operator`.

## Decision tree

| Situation | Use |
|---|---|
| Test **run** (CI or local), known frozen locators | **Deterministic driver** — replay frozen locators. No MCP, no AI. |
| Authoring: discover/freeze on a target with a socket or control tree | **`screen-driver` MCP** (object introspection) |
| Authoring: no object model reachable, need to find a control | **Local CV (OpenCV) + offline OCR (PaddleOCR/EasyOCR)** → propose, then freeze a Tier-1/2 locator. Authoring only. |
| Locator drift on an existing spec | **Supervised Tier-4 re-pin** (human-approved), via `screen-flake-hardening` |
| Target exposes a real **DOM** | **Playwright** (`playwright` MCP / web lane) — do not use the screen driver |
| Need golden-image baseline | Playwright `toHaveScreenshot` / BackstopJS (rendering oracle) |
| Need text readability check | Offline OCR (PaddleOCR / EasyOCR / Tesseract, all Apache-2.0) — legibility oracle |

## Invariants

- **Runtime is deterministic.** If a path can be reached from a test run, it must not call vision,
  computer-use, or the `screen-driver` MCP's discovery functions.
- **Prefer Tier 1.** Object/control-tree over image template; template over vision.
- **DOM stays on Playwright.** Never reimplement DOM testing on the screen driver.
- **Isolation.** Authoring runs in an isolated VM; no secrets or operational data to any model.

## Quick examples

- *Known route + known frozen locators* → deterministic driver (`npm run test:screen`).
- *New screen, has a control tree* → `screen-driver` MCP, freeze Tier-1, hand to `screen-test-designer`.
- *New screen, framebuffer only* → local CV + OCR discovery → pin Tier-2 template (DPI/theme stamped) → freeze.
- *Spec drifted after a theme change* → `screen-flake-hardening` → supervised re-pin.
