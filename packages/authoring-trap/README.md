# @erkanbarin/authoring-trap

Trap-lane **authoring** assets for `multilanetesting` — the AI-facing skill and agent used to write
receive-only SNMP notification contract checks. Companion package to the SNMP-lane **runtime**
packages, [`@erkanbarin/snmp-runtime`](../snmp-runtime/README.md) and
[`@erkanbarin/snmp-model`](../snmp-model/README.md), and never a dependency of either.

```
@erkanbarin/snmp-runtime    = startTrapListener (receive-only) + startEmulatedAgent (the sender)
@erkanbarin/authoring-trap  = trap skill, agent and metadata (this package)
```

The `snmp` and `trap` lanes are the two halves of one runtime: `snmp` is request/response
(GET/WALK), `trap` is the receive-only notification half. The request/response half has its own
authoring package, [`@erkanbarin/authoring-snmp`](../authoring-snmp/README.md).

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, skill/agent list, env prerequisites (no MCP server needed for this lane).
- `assets/skills/trap-test-authoring/SKILL.md` — always-installable authoring skill (source of
  truth, Claude-skill format).
- `assets/agents/trap-inspector/AGENT.md` — optional authoring agent that requires
  `MULTILANE_TRAP_PORT` to be set (source of truth, Claude-agent format).

## Receive-only, loopback by default

`startTrapListener` never sends and never injects. The packaged guidance keeps the listener bound to
loopback: `MULTILANE_TRAP_BIND` is an explicit, deliberate widening, and widening it past loopback
additionally requires the sending host to be present in `MULTILANE_APPROVED_HOSTS` — there is no
implicit fallback. Live trap traffic uses privileged port 162, so `MULTILANE_TRAP_PORT` names a high
port or a redirect instead.

## Who consumes this package

Not test authors directly. `mlt authoring install` (from `@erkanbarin/cli`) resolves this package
from the consumer project's `node_modules`, reads `lane.manifest.json`, and materializes
tool-specific wrapper files into the consumer repo.

## Runtime isolation

Zero dependencies, no executable test logic, and neither `@erkanbarin/snmp-runtime` nor
`@erkanbarin/snmp-model` references it. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine
root for the isolation proof pattern (same shape as the web, HTTP, and STOMP lanes).
