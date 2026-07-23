---
name: http-test-authoring
description: Author passive HTTP/JSON API contract checks for the multilanetesting HTTP lane. Always installable — no MCP server or extra tooling required.
user-invocable: true
---

# http-test-authoring

Write and maintain passive HTTP/JSON contract specs under `tests/http/**`. Runtime capability lives
in `@multilane/http` (`getJson`, `assertShape`, `assertApprovedHost`); this skill is the
authoring-time companion — it never runs as part of a test.

## Procedure

1. **Confirm the lane is opt-in and passive.** `tests/http/**` runs only under
   `MULTILANE_API_CONTRACT=1` and is never part of the default `npm test` run. Every request is a
   read-only GET — no state mutation, no destructive calls, ever.
2. **Drive host + allowlist from env.** Use `MULTILANE_TARGET_HOST` for the base URL and pass
   `MULTILANE_APPROVED_HOSTS` (comma-separated) to `assertApprovedHost`/`getJson` — never hardcode a
   host literal in a committed spec.
3. **Assert shape and invariants, not volatile values.** Use `assertShape(body, { key: 'type' })`
   for structural checks (keys present, correct `typeof`) and assert status/headers explicitly.
   Do not assert on data that changes between runs (timestamps, counters, generated ids).
4. **One spec per endpoint/contract behavior.** Name steps by user-observable intent
   (`"the health endpoint reports ok"`), not by HTTP mechanics.
5. **No AI in the loop at runtime.** This lane is deterministic Node (`node:https`/`tsx`) — nothing
   here calls a model when a test runs.
6. **Record coverage and blockers.** Track each slice covered in this project's own coverage record;
   anything unobservable passively goes in this project's blocker log, not into a skipped/fake
   assertion.

## Guardrails

- No `POST`/`PUT`/`PATCH`/`DELETE` calls, no state mutation of any kind.
- No host/URL literals — reference the env-var name in comments and code.
- Do not assert on volatile response values; assert shape, status, and structural invariants.

## When you need more

- Need to discover an endpoint's actual shape before writing the assertion, or troubleshoot an
  auth/retry failure → hand off to **api-explorer** (requires `MULTILANE_TARGET_HOST` and
  `MULTILANE_APPROVED_HOSTS` to be set; see `mlt authoring configure http-explorer` if it reports as
  not enabled).
- No live target is reachable yet → point the explorer at a local emulator instead of inventing
  response shapes from memory.

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
