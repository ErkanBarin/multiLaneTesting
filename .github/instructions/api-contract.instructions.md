---
applyTo: "tests/http/**"
description: Path-scoped guidance for the passive HTTP/JSON API contract lane.
---

# API contract lane

Applies to `tests/http/**`. Passive shape/contract checks over HTTP/JSON. Opt-in via
`MULTILANE_API_CONTRACT=1`; not part of the default `npm test` run.

- **Passive only.** GET/read shape, status, and headers. No state mutation, no destructive calls.
- Drive host + allowlist from env (`MULTILANE_TARGET_HOST`, `MULTILANE_APPROVED_HOSTS`) — no host literals.
- Assert response **shape and invariants**, not volatile data values.
- No AI in the loop — this lane is deterministic Node (`node:https` / `tsx`).
- Record each slice in `docs/coverage-map.md`; note anything unobservable in `docs/memory/blocker-index.md`.
