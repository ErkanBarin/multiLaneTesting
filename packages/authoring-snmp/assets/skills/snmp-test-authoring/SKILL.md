---
name: snmp-test-authoring
description: Author SNMP contract checks for the multilanetesting SNMP lane — model validation, emulated-agent GET/WALK assertions, and opt-in read-only checks against a live agent. Always installable — no MCP server or extra tooling required.
user-invocable: true
---

# snmp-test-authoring

Write and maintain SNMP contract specs under `tests/snmp/**`. Runtime capability lives in
`@multilane/snmp-runtime` (`startEmulatedAgent`, `OBJECT_TYPE`) and `@multilane/snmp-model`
(`validateModel`); this skill is the authoring-time companion — it never runs as part of a test.

## Procedure

1. **Start from the model, not the wire.** An `EmulatedAgentModel` is the contract: `scalars`,
   `tables`, `notifications`, and `gaps`. Assert `validateModel(model)` returns `[]` as the first
   test in any new spec — a structurally invalid model makes every downstream assertion meaningless.
2. **Default to the emulator.** `startEmulatedAgent({ model, port, community })` runs in-process and
   needs no live agent, so a freshly scaffolded project is green with no infrastructure. Reach for a
   live agent only when the behavior under test cannot exist in the emulator.
3. **Bind loopback and take an ephemeral port.** The runtime binds `127.0.0.1` by default — keep it.
   A fixed port makes two projects on one CI agent collide, and the collision reads as a flaky test
   rather than a port clash. Bind `0` and read back `socket.address().port`.
4. **Treat the community string as a live credential.** Generate a per-run value for the emulator;
   for a live agent read the name `MULTILANE_SNMP_COMMUNITY` from the environment. Never commit a
   community string, and never write one into a spec, a fixture, or a log line.
5. **Read-only by default.** Issue GET and WALK only. A SET requires **explicit approval**:
   `MULTILANE_SNMP_WRITE=1` **and** the target host present in `MULTILANE_APPROVED_HOSTS`. There is
   no implicit fallback — unset means read-only, and an unapproved host means no call at all.
6. **Assert declared shape, not volatile values.** Assert that a scalar the model declares is
   readable, that its type matches the model's `SnmpBaseType`, and that an enumerated object returns
   a value its `enumValues` map contains. Do not assert on counters, uptime, or anything that moves
   between runs.
7. **Keep `gaps` visible.** A non-empty `model.gaps` is a finding about the input MIB or conf, not a
   defect to paper over. Record it in this project's blocker log; never delete a gap to make a spec
   pass, and never assert against an object that is listed as a gap.
8. **Record coverage and blockers.** Track each slice covered in this project's own coverage record;
   anything unobservable without a write goes in the blocker log, not into a skipped or faked
   assertion. `requirement_ref` values come from this project's traceability record — never invented.

## Live-agent checks (opt-in)

`tests/snmp/**` runs against the emulator unless `MULTILANE_SNMP_CONTRACT=1`. When it is set, the
target comes from `MULTILANE_SNMP_HOST` / `MULTILANE_SNMP_PORT` and must be present in
`MULTILANE_APPROVED_HOSTS` before any request is issued. Never hardcode a host literal in a
committed spec — reference the env-var name.

## Guardrails

- No SET, no table-row mutation, and no `goSilent()` against a live agent without the write opt-in
  **and** an approved host. Start read-only and stay there unless the requirement demands otherwise.
- No host literals, no community strings, no credentials in committed files — env-var names only.
- Do not assert on volatile values; assert declared shape, type, and enumeration membership.
- No AI in the loop at runtime — this lane is deterministic Node plus `net-snmp`.

## When you need more

- Need to discover what an agent actually serves before writing the assertion, or reconcile a model
  against a live walk → hand off to **snmp-explorer** (requires `MULTILANE_SNMP_HOST` and
  `MULTILANE_APPROVED_HOSTS`; see `mlt authoring configure snmp-explorer` if it reports as not
  enabled).
- No live agent is reachable → point the explorer at the emulator instead of inventing OIDs and
  types from memory.

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
