# Requirement index — `multilanetesting`

Shortcut map from requirement IDs to the lane + spec that exercises them. The full matrix lives in
[`../traceability.md`](../traceability.md); this is the compact queryable view.

## Mapping

| Requirement | Lane | Spec / evidence | Coverage | Last verified |
|---|---|---|---|---|
| <!-- example --> REQ_SCR_001 | screen driver | `tests/sample-panel/create.spec` | full (functional + golden) | — |
| <!-- example --> REQ_SCR_002 | screen driver | `tests/doc-viewer/navigate.spec` | partial (rendering only — see BLK_001) | — |
| <!-- example --> REQ_API_001 | api-contract | `tests/http/.../regulations` | shape only | — |

Coverage values: `full` · `partial` (say why + link the blocker) · `none` (planned) · `n/a`.

## Rules

- Every shipped spec carries a `requirement_ref` that matches a row here and in `traceability.md`.
- `partial`/`none` rows must point at a `blocker-index.md` ID explaining the gap — no silent gaps.
- This index records **black-box SuV evidence**, not white-box certification claims (see
  `docs/traceability.md` for the process-traceability boundary).
