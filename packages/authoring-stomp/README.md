# @multilane/authoring-stomp

STOMP/WS-lane **authoring** assets for `multilanetesting` — the AI-facing skill and agent used to
create and explore passive STOMP/WebSocket contract checks (and the supervised active-SEND
opt-in). Companion package to the STOMP-lane **runtime** package,
[`@multilane/stomp`](../stomp/README.md), and never a dependency of it.

```
@multilane/stomp            = STOMP runtime capability (subscribeOnce, supervised send)
@multilane/authoring-stomp   = STOMP skill, agent and metadata (this package)
```

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, skill/agent list, env prerequisites (no MCP server needed for this lane).
- `assets/skills/stomp-test-authoring/SKILL.md` — always-installable authoring skill (source of
  truth, Claude-skill format).
- `assets/agents/stomp-explorer/AGENT.md` — optional authoring agent that requires
  `MULTILANE_WS_URL` to be set (source of truth, Claude-agent format).

## Who consumes this package

Not test authors directly. `mlt authoring install` (from `@multilane/cli`) resolves this package
from the consumer project's `node_modules`, reads `lane.manifest.json`, and materializes
tool-specific wrapper files into the consumer repo.

## Runtime isolation

Zero dependencies, no executable test logic, and `@multilane/stomp`'s `package.json` does not
reference it. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine root for the isolation
proof pattern (same shape as the web lane).
