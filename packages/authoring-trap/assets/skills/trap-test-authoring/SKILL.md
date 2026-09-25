---
name: trap-test-authoring
description: Author receive-only SNMP trap/notification contract checks for the multilanetesting trap lane — bind a listener, wait on a varbind predicate, and assert the decoded notification against the model. Always installable — no MCP server or extra tooling required.
user-invocable: true
---

# trap-test-authoring

Write and maintain trap contract specs under `tests/trap/**`. Runtime capability lives in
`@erkanbarin/snmp-runtime` (`startTrapListener`, and `startEmulatedAgent` as the sender); this skill
is the authoring-time companion — it never runs as part of a test.

## The lane is receive-only

`startTrapListener` never sends and never injects. It binds a UDP port, records every notification
it receives, and resolves `waitForTrap(predicate, timeoutMs)` on the first match. A trap spec
asserts what **arrived**; it never asks a live dispatcher to emit something.

## Procedure

1. **Model the notification first.** The `EmulatedAgentModel`'s `notifications` entry declares the
   notification's `oid` and the `objects` (varbinds) it carries, in declaration order. Assert
   against those declared objects — a varbind the model does not declare is a finding about the
   model or the sender, not something to assert ad hoc.
2. **Make the spec self-contained.** Pair `startTrapListener({ port })` with an emulated agent as
   the sender (`startEmulatedAgent({ ..., trapTarget: { port, community } })`, then `agent.set(...)`
   and `await agent.emit(...)`). That is what makes the lane runnable with no live dispatcher
   anywhere, and it is the default path.
3. **Bind loopback and take an ephemeral port.** `MULTILANE_TRAP_BIND` defaults to `127.0.0.1` —
   widen it deliberately, never implicitly. Live trap traffic uses port 162, which is privileged;
   use a high port (`MULTILANE_TRAP_PORT`) or a redirect, and bind `0` for a free port in tests so
   two projects on one CI agent cannot collide.
4. **Wait on a predicate, never on a timer.** `waitForTrap((n) => n.varbinds.some(...), timeoutMs)`
   matches on content. No `sleep`, no fixed delay, no polling loop — an arrival is an event.
5. **Assert the decoded varbind, not the datagram.** Check the varbind OID the model declares and
   its value against the scalar's `enumValues` label where the object is enumerated. Do not assert
   on `source.port`, on arrival order across independent notifications, or on timestamps.
6. **Always close.** Close the listener and the agent in a `finally` — a leaked UDP socket keeps the
   test process alive and turns a clean failure into a hung CI job.
7. **Record coverage and blockers.** Track each notification covered in this project's own coverage
   record; a notification you cannot trigger without a mutating call goes in the blocker log, not
   into a skipped or faked assertion. `requirement_ref` values come from this project's traceability
   record — never invented.

## Live-dispatcher checks (opt-in)

A spec that listens for traps from real infrastructure rather than the emulated agent runs only
under the project's explicit opt-in, and the sending host must be present in
`MULTILANE_APPROVED_HOSTS` before the listener is widened beyond loopback. There is no implicit
fallback: no approved host means loopback only.

## Guardrails

- Receive-only. Never send a trap, never inform, never ask a live system to emit one.
- Never bind `0.0.0.0` (or a routable interface) by default — `MULTILANE_TRAP_BIND` is an explicit,
  deliberate widening, and an unapproved host means it stays on loopback.
- No host literals, no community strings, no credentials in committed files — env-var names only.
  A trap listener's expected community comes from the environment, never a committed value.
- No sleeps — `waitForTrap` with a predicate and a timeout is the only wait.
- No AI in the loop at runtime — this lane is deterministic Node plus `net-snmp`.

## When you need more

- Need to see what a real dispatcher actually sends before writing the assertion, or decode a
  notification whose varbinds do not match the model → hand off to **trap-inspector** (requires
  `MULTILANE_TRAP_PORT`; see `mlt authoring configure trap-inspector` if it reports as not enabled).
- No live sender is reachable → drive the emulated agent instead of inventing varbind shapes from
  memory.

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
