# Blocker index — `multilanetesting`

What is **unobservable, blocked, or out of scope**, recorded honestly so agents don't waste effort or
invent assertions for things they cannot prove.

## Blockers

| ID | What | Why blocked | Status | Last verified |
|---|---|---|---|---|
| BLK_003 | OmniParser icon-detect license | ~~AGPL component needs legal review before any shipped use~~ | **Resolved 2026-06-30** — OmniParser dropped; replaced with OpenCV + offline OCR (Apache-2.0). See `docs/memory/tool-licence-audit.md`. | 2026-06-30 |

## Rules

- If a behavior is blocked (no functional channel, needs `PROD`, canvas-only with no readback), **do not
  invent an assertion** to make a green test. Record it here and route around it.
- A blocker is honest about *partial* coverage: state exactly what is and isn't provable (e.g.
  "rendering verified via golden-image, functional state not observable").
- Clear a blocker only when the underlying constraint actually changes; update "Last verified".
- Never write host literals, secrets, or transcript excerpts into a blocker entry.
