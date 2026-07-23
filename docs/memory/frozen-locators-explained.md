# Frozen Locators — How It Works (plain version)

_Last updated: 2026-06-30_

---

## The core idea

A **frozen locator** is a saved address for a UI control on a screen-only target (screen-only HMI, desktop application, COTS).

- Discovered **once**, by a human + AI working together in VS Code.
- Written to a file under `locators/<area>/` and committed.
- Every test run after that just **replays** the frozen address — no AI, no discovery, no internet.

---

## The screen-driver MCP — the bridge between VS Code and the target

The **screen-driver MCP** is an MCP server that runs at authoring time only (never in CI). It sits between VS Code / Copilot and the live screen target and exposes two channels:

| Channel | What it gives you |
|---------|------------------|
| **Object-introspection socket** | A live query API into the app's internal object/widget tree — returns object IDs, types, states, values without touching the screen pixels |
| **a11y bridge** | The accessibility tree of the target UI — same idea, different protocol |

Copilot calls the MCP from inside VS Code like any other tool. A human watches the conversation and approves each step before anything is written.

---

## The two-phase workflow

### Phase 1 — Authoring (done once, human + AI in VS Code)

There are **two paths**, depending on whether the app exposes its internals.

#### Path A — Object discovery (Tier 1, preferred)

The screen-driver MCP queries the app's object/a11y tree directly. No screenshot needed.

| Step | What happens | Tool |
|------|-------------|------|
| 1 | Copilot calls the MCP: "list all controls on the screen-only HMI screen" | screen-driver MCP → object socket |
| 2 | MCP returns a structured tree: object IDs, types, current values | app internals |
| 3 | Copilot reads the tree and identifies the control by ID/path | GitHub Copilot (VS Code) |
| 4 | Human approves → **Tier-1 locator** frozen (object ID / a11y path) | you |

This is the most stable path — no pixel coordinates, survives resolution/theme changes.

#### Path B — Visual discovery (Tier 2/3, fallback when the app has no object API)

Used when the target is a black box with no introspection socket (e.g. a COTS tool over VNC).

| Step | What happens | Tool |
|------|-------------|------|
| 1 | Take a screenshot of the screen target | pyautogui |
| 2 | Local CV + OCR analyses the screenshot and returns a list of detected elements — each with a bounding box, an OCR text label, and a confidence score | OpenCV region proposals + offline OCR (PaddleOCR/EasyOCR, all Apache-2.0, run locally) |
| 3 | Copilot reads that list (a JSON of boxes + labels) and matches them to what you described — e.g. "the FL field on the BAW123 label" | GitHub Copilot (VS Code) |
| 4 | Human reviews the match → **Tier-2 locator** frozen (image template crop + DPI/theme stamp) | you |

**How Copilot does the identification in step 3:**
The local CV + OCR pass gives Copilot a list like `[{"label": "FL350", "box": [410,305,490,325]}, ...]`. The human describes the target control in plain language in the chat. Copilot cross-references the label text, position, and context to pick the right box. There is no guessing at runtime — this match happens once, a human confirms it, and then it is frozen.

**AI is only here, in this phase, while a human is watching.**

### Phase 2 — Runtime (every CI run, zero AI)

| Step | What happens | Tool |
|------|-------------|------|
| 1 | RPS replays the recorded scenario (inputs only — see below) | RPS |
| 2 | OpenCV finds the frozen locator on the live screen | OpenCV (local, Apache) |
| 3 | Driver clicks/types at that location | screen driver |
| 4 | Three oracles verify the result → pass/fail → Jenkins | object channel + golden image + OCR |

**No model. No API call. No internet. Same result every run.**

---

## What RPS actually freezes

> **RPS freezes the INPUT, not the output.**

RPS records the operator's clicks and keystrokes and plays them back. The screen-only HMI software still runs normally and produces its own output — the test then checks whether that output is correct. This means:

- The test is not a recording of the screen — it is a **functional check** of live software.
- If the software changes behaviour, the test catches it.
- If only the visual rendering changes (colour theme, font), only the golden-image oracle needs updating — the functional gate still passes.

---

## A concrete example

**Scenario:** "User opens a flight label and sees the flight level."

**Phase 1 — Path A (screen-only HMI has an object socket):**
1. Human says to Copilot: "I need a locator for the flight-level field on label BAW123."
2. Copilot calls the screen-driver MCP: `queryObject("BAW123.flightLevel")`
3. MCP returns: `{id: "lbl_BAW123_fl", type: "readout", value: "FL350"}`
4. Human approves → committed as `locators/cwp/flight-label-fl-field.json`:
   ```json
   {
     "tier": 1,
     "objectId": "lbl_BAW123_fl",
     "requirement_ref": "screen-only HMI-LABEL-01"
   }
   ```

**Phase 1 — Path B (COTS target, no object API):**
1. pyautogui takes a screenshot.
2. Local OpenCV + OCR returns: `[{"label": "FL350", "box": [410,305,490,325]}, ...]`
3. Human says to Copilot: "that's the FL field on BAW123" — Copilot picks the matching box.
4. Human approves → committed as `locators/cwp/flight-label-fl-field.json`:
   ```json
   {
     "tier": 2,
     "template": "assets/fl-field-FL350.png",
     "dpi": 96,
     "theme": "dark",
     "requirement_ref": "screen-only HMI-LABEL-01"
   }
   ```

**Phase 2 (every CI run — same for both paths):**
1. RPS replays the scenario (opens the sector, selects the flight).
2. Driver reads the value: Tier-1 → via object socket directly; Tier-2 → OpenCV finds the template then reads via object channel.
3. Assert: value == "FL350" (functional gate).
4. Golden-image oracle corroborates the visual rendering.
5. Jenkins reports pass.

---

## Where AI is used

| Where | AI used? | Why |
|-------|----------|-----|
| Phase 1 — authoring | ✅ Yes | To identify which pixel region is which control |
| Phase 2 — CI run | ❌ No | Frozen locator is replayed deterministically |
| Flake investigation | ✅ Authoring only | To propose a new locator after drift; human approves before it runs |

---

## Locator tiers (in priority order)

1. **Object introspection** — query the app's internal object/a11y tree (most stable)
2. **Image template** — OpenCV match against a frozen screenshot crop (stable)
3. **Vision (local CV, authoring only)** — OpenCV region proposals + offline OCR; Copilot matches (never in CI)
4. **Supervised heal** — human-approved re-pin after genuine drift (authoring only)

Always use the highest (lowest-numbered) tier available.

---

## One-line summary

> AI picks the coordinates once, at authoring time, in VS Code.
> CI replays a frozen recipe — no model, no internet, deterministic every run.
