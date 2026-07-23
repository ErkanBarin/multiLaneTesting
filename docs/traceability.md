# Traceability — `multilanetesting`

Requirement → lane → spec → evidence, plus the **process-traceability boundary** (what kind of claim
this evidence supports). Seed scaffold.

## Requirement coverage

| Requirement | Lane | Spec / evidence | Oracle | Coverage | Blocker |
|---|---|---|---|---|---|
| <!-- example --> REQ_SCR_001 | screen driver | `tests/sample-panel/create.spec` | functional + golden | full | — |
| <!-- example --> REQ_SCR_002 | screen driver | `tests/doc-viewer/navigate.spec` | golden | partial | BLK_001 |
| <!-- example --> REQ_API_001 | api-contract | `tests/http/...` | shape | full | — |

## Process-traceability boundary (read before claiming compliance)

This framework produces **black-box, system-under-validation (SuV) evidence** — it exercises the
delivered system through its real surfaces and records functional/rendering/legibility outcomes.

- It is **not** white-box CUT (code/unit test) or SoV (software verification) evidence, and does not by
  itself substantiate a software-assurance-level certification claim.
- Map each spec to the **V-model verification phase** it serves (typically SuV / system validation) and
  to the artifact that consumes it (test description → test procedure → test report).
- Where a requirement needs white-box evidence, this matrix records the SuV portion and points to the
  owning white-box activity rather than overclaiming.

## Rules

- Every shipped spec has a `requirement_ref` matching a row here and in
  `docs/memory/requirement-index.md`.
- `partial`/`none` rows cite a blocker ID — no silent gaps.
- Update on every closeout; this file plus `coverage-map.md` are the audit trail.
