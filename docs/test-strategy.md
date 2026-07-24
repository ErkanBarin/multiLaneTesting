# Test strategy — `multilanetesting`

End-to-end verification for any multi-surface system under test. Build only the lanes the target system
actually exposes — confirmed in the Phase 0 surface inventory.

## Principle

Build the simplest reachable lane first. For the screen-driver lane: **AI at authoring, never at
runtime** — vision discovers and *freezes* locators; runs replay them deterministically with no model
in the loop, near-zero CI cost, and fully reproducible results.

## Lanes

| Lane | When to build | What it proves | Tool |
|---|---|---|---|
| **Web / DOM** | Target exposes a browser/DOM UI | DOM behaviour, user flows | Playwright + selector factories |
| **API contract** | Target exposes REST/HTTP endpoints — opt-in `MULTILANE_API_CONTRACT=1` | HTTP/JSON shape & invariants (passive) | Node `node:https` / `tsx` |
| **WS contract** | Target emits/accepts STOMP frames — opt-in `MULTILANE_WS_CONTRACT=1` | STOMP message shape (passive); supervised active SEND (`+MULTILANE_WS_INJECT=1`) | Node test runner + STOMP client |
| **Screen driver** | Target renders to screen with no DOM (VNC/RDP, C++ HMI, COTS) | Functional + rendering + legibility | Deterministic driver (frozen Tier-1/2 locators) + oracles |

## Oracles (core lane)

1. **Functional truth** — object/state channel. The gate.
2. **Rendering truth** — golden-image diff (mask volatile regions).
3. **Legibility truth** — offline OCR.

A spec must assert functional truth; the other two corroborate.

## Determinism rules

- Replay a recorded **RPS scenario** into a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`) — never `PROD`.
- Frozen Tier-1/2 locators only at runtime. No vision/computer-use in the run path — a policy
  pattern-checked by the `check:no-runtime-ai` gate and upheld in code review.
- No sleeps — wait on the object channel. No host literals — env-var names only.
- Run a touched spec **twice**; identical functional readback required.

## Tool selection rationale (screen-driver lane)

Toolchain chosen for the cleanest licence (MIT/Apache preferred), **zero external network egress at
runtime**, and broadest coverage of the target types (Win32 C++ HMI, COTS over VNC). All inference is
local/offline; model weights are pre-provisioned, never committed. _Verified 2026-06-30 — full table in
`docs/memory/tool-licence-audit.md`._

| Tier / role | Tool | SPDX | Offline |
|---|---|---|---|
| Tier 1 — object/control-tree introspection | screen-driver MCP object socket (screen-only HMI) + pywinauto via MS UI Automation (Win32/desktop application) | BSD-3-Clause (pywinauto) | Yes |
| Tier 2 — image template | OpenCV template matching | Apache-2.0 | Yes |
| Tier 3 — assisted discovery (authoring only) | OpenCV region proposals + offline OCR (PaddleOCR/EasyOCR) | Apache-2.0 | Yes |
| Tier 4 — supervised heal | human re-pin | — | Yes |
| Legibility oracle (runtime) | PaddleOCR (primary) / EasyOCR / Tesseract | Apache-2.0 | Yes |
| Web / DOM lane | Playwright + playwright-mcp | Apache-2.0 | n/a |

**OmniParser v2 was dropped.** Its `icon_detect` weights are **AGPL-3.0** (inherited from YOLO) and its
repo code is CC-BY-4.0; the paired computer-use loop also egresses screenshots to external LLM APIs.
Both are incompatible with an air-gapped environment even at authoring time. The replacement
OpenCV + OCR discovery path is fully Apache-2.0/BSD-3-Clause and offline, preserving the unchanged
**"AI at authoring, never at runtime"** principle.

## What this strategy deliberately does **not** do

- It does not replace white-box CUT/SoV certification — it produces **black-box SuV evidence**.
- It does not bring DOM testing onto the screen driver — DOM stays on Playwright.
- It does not put AI in the runtime path to "find" controls — drift is fixed by **supervised re-pin**.

See `docs/coverage-map.md` for the matrix and `docs/traceability.md` for requirement mapping.
