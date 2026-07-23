# Coverage map — `multilanetesting`

Matrix of functional areas × lanes × oracle depth. Seed scaffold — replace example rows as specs land.

## Matrix

| Area | Screen driver | Web/DOM | API | WS | Oracle depth | Status |
|---|---|---|---|---|---|---|
| <!-- example --> sample-panel | ✅ | — | — | — | functional + golden | covered |
| <!-- example --> data-view | ◑ | — | — | — | golden only (BLK_001) | partial |
| <!-- example --> status-endpoint | — | — | ✅ shape | — | n/a | covered |
| <!-- example --> event-stream | — | — | — | ◑ passive | n/a | partial |

Legend: ✅ covered · ◑ partial (link a blocker) · — not applicable / not started.

## Oracle depth per area

- **functional + golden + OCR** = strongest (object channel + pixel + text).
- **functional only** = object channel verified, rendering not pinned yet.
- **golden only** = rendering verified, no functional channel (record the blocker).

## Rules

- A cell is `covered` only when the spec passes **twice** with identical functional readback (or, for
  passive contract lanes, shape assertions are stable).
- `partial` cells must link a `docs/memory/blocker-index.md` ID.
- Keep this matrix in sync with `docs/memory/requirement-index.md` and `docs/traceability.md`.
