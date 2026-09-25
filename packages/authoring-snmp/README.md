# @erkanbarin/authoring-snmp

SNMP-lane **authoring** assets for `multilanetesting` — the AI-facing skill and agent used to write
SNMP contract checks against an emulated or live agent. Companion package to the SNMP-lane
**runtime** packages, [`@erkanbarin/snmp-runtime`](../snmp-runtime/README.md) and
[`@erkanbarin/snmp-model`](../snmp-model/README.md), and never a dependency of either.

```
@erkanbarin/snmp-model      = the EmulatedAgentModel contract + validateModel
@erkanbarin/snmp-runtime    = the controllable in-process agent (startEmulatedAgent)
@erkanbarin/authoring-snmp  = SNMP skill, agent and metadata (this package)
```

The `trap` lane shares these runtime packages and has its own authoring package,
[`@erkanbarin/authoring-trap`](../authoring-trap/README.md) — `snmp` is the request/response half,
`trap` the receive-only notification half.

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, skill/agent list, env prerequisites (no MCP server needed for this lane).
- `assets/skills/snmp-test-authoring/SKILL.md` — always-installable authoring skill (source of
  truth, Claude-skill format).
- `assets/agents/snmp-explorer/AGENT.md` — optional authoring agent that requires
  `MULTILANE_SNMP_HOST` and `MULTILANE_APPROVED_HOSTS` to be set (source of truth, Claude-agent
  format).

## Read-only by default

The packaged guidance starts read-only and stays there. A SET or a row mutation against a live
agent requires **both** `MULTILANE_SNMP_WRITE=1` and the target host present in
`MULTILANE_APPROVED_HOSTS` — there is no implicit fallback for either. The community string is
treated as a live credential throughout: `MULTILANE_SNMP_COMMUNITY` names it, and no committed file
ever carries a value.

## Who consumes this package

Not test authors directly. `mlt authoring install` (from `@erkanbarin/cli`) resolves this package
from the consumer project's `node_modules`, reads `lane.manifest.json`, and materializes
tool-specific wrapper files into the consumer repo.

## Runtime isolation

Zero dependencies, no executable test logic, and neither `@erkanbarin/snmp-runtime` nor
`@erkanbarin/snmp-model` references it. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine
root for the isolation proof pattern (same shape as the web, HTTP, and STOMP lanes).
