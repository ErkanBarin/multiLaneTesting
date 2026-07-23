---
name: stomp-test-authoring
description: Author passive STOMP/WebSocket contract checks for the multilanetesting STOMP lane, including the supervised active-SEND opt-in. Always installable — no MCP server or extra tooling required.
user-invocable: true
---

# stomp-test-authoring

Write and maintain STOMP/WS contract specs under `tests/stomp/**`. Runtime capability lives in
`@multilane/stomp` (`subscribeOnce`, supervised `send`); this skill is the authoring-time
companion — it never runs as part of a test.

## Procedure

1. **Confirm the lane is opt-in and passive by default.** `tests/stomp/**` runs only under
   `MULTILANE_WS_CONTRACT=1` and is never part of the default `npm test` run.
2. **SUBSCRIBE by default.** Use `subscribeOnce(url, destination, { timeoutMs })` to assert message
   **shape/contract**, not volatile values (ids, timestamps, sequence numbers).
3. **Drive the broker URL from env.** `MULTILANE_WS_URL` for the broker, `MULTILANE_APPROVED_HOSTS`
   for the allowlist — never hardcode a host literal in a committed spec.
4. **Active SEND is supervised and strictly opt-in.** It requires **both**
   `MULTILANE_WS_CONTRACT=1` **and** `MULTILANE_WS_INJECT=1`, plus an approved host in
   `MULTILANE_APPROVED_HOSTS`. Only ever propose one SEND occurrence at a time, only against an
   approved test host, never against production/`PROD`.
5. **No AI in the loop at runtime.** This lane is deterministic Node (test runner + STOMP client) —
   nothing here calls a model when a test runs.
6. **Record coverage and blockers.** Track each slice covered in this project's own coverage record;
   anything unobservable passively goes in this project's blocker log, not into a skipped/fake
   assertion.

## Guardrails

- No sleeps — wait on the subscription/message channel (`subscribeOnce`'s own timeout), not on
  wall-clock time.
- No host/URL literals — reference the env-var name in comments and code.
- Never enable any "bypass approvals"/autopilot mode for a session that may touch active SEND — it
  silently approves the host preflight and defeats the guard.

## When you need more

- Need to discover a destination's actual message shape, or debug subscription timing/flake →
  hand off to **stomp-explorer** (requires `MULTILANE_WS_URL` to be set; see
  `mlt authoring configure stomp-explorer` if it reports as not enabled).
- No live broker is reachable yet → point the explorer at a local STOMP-over-WS emulator instead of
  inventing message shapes from memory.

## Coding style — ponytail (lazy-first)

When generating specs or helpers, climb this ladder and stop at the first rung that holds:

1. Does this need to exist? Speculative need → skip it, say so in one line. (YAGNI)
2. Already in this codebase? Reuse it — look before you write.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dep solves it? Use it.
6. Can it be one line? Write one line.
7. Only then: the minimum code that works.

Shortest working diff wins. No unrequested abstractions, no boilerplate "for later", deletion over
addition. Mark deliberate shortcuts: `# ponytail: <ceiling>, <upgrade-path>`.
