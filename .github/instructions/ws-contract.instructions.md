---
applyTo: "tests/stomp/**"
description: Path-scoped guidance for the passive STOMP/WebSocket contract lane, including the supervised active-SEND opt-in.
---

# WS contract lane

Applies to `tests/stomp/**`. Passive SUBSCRIBE by default; supervised active SEND is strictly
opt-in. Opt-in via `MULTILANE_WS_CONTRACT=1`; not part of the default `npm test` run.

## Passive (default)

- SUBSCRIBE to broadcast destinations and assert message **shape/contract**, not volatile values.
- Drive host from env (`MULTILANE_WS_URL`, `MULTILANE_APPROVED_HOSTS`) — no host literals.
- Deterministic Node (test runner + STOMP client). No AI in the loop.

## Active SEND (supervised, two-flag opt-in)

- Requires **both** `MULTILANE_WS_CONTRACT=1` **and** `MULTILANE_WS_INJECT=1`, **plus** an approved host in
  `MULTILANE_APPROVED_HOSTS`. The approved-host preflight must prompt before each mutating call.
- Run one occurrence at a time against an approved test host only. Never against production/`PROD`.
- **Do not** enable any "bypass approvals"/autopilot mode for sessions that may touch active SEND —
  it silently approves the host preflight and defeats the guard.
