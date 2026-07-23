---
name: screen-test-designer
description: Author a deterministic screen spec from a frozen-locator set — RPS fixture into a test partition, frozen Tier-1/2 locators, functional-truth gate corroborated by golden-image and OCR, JUnit/HTML evidence with a requirement_ref. No runtime AI.
argument-hint: <area + frozen-locator keys, e.g. "mil-areas: createButton, areaList">
agent: screen-test-designer-worker
tools: ["read", "search", "edit", "execute"]
---

# /screen-test-designer

Source of truth: [`.claude/agents/screen-test-designer.md`](../../.claude/agents/screen-test-designer.md)
+ [`.claude/skills/screen-test-implementation/SKILL.md`](../../.claude/skills/screen-test-implementation/SKILL.md).

Write one spec per behavior in `tests/<area>/<feature>.spec` using **only** frozen Tier-1/2 locators.
Replay an RPS scenario into a **test partition** (never `PROD`). Assert **functional truth** as the
gate; corroborate with golden-image (mask volatile regions) and offline OCR. Emit JUnit + HTML with a
`requirement_ref`. Steps name user intent and outcome (`user opens…`, `user sees…`), not mechanics.

If a locator is missing or drifted, **stop** and route to `/screen-explorer` (new freeze) or
`/screen-flake-debugger` (drift) — do not improvise a runtime template or vision call. Run the spec
**twice**; require identical functional readback.

**Return:** A. one-line goal · B. spec(s) added + evidence path · C. deferred coverage ·
D. next prompt (`/repo-keeper`).
