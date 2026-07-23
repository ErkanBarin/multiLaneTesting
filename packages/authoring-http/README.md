# @multilane/authoring-http

HTTP-lane **authoring** assets for `multilanetesting` — the AI-facing skill and agent used to
create and explore passive HTTP/JSON contract checks. Companion package to the HTTP-lane
**runtime** package, [`@multilane/http`](../http/README.md), and never a dependency of it.

```
@multilane/http            = HTTP runtime capability (getJson, assertShape, assertApprovedHost)
@multilane/authoring-http   = HTTP skill, agent and metadata (this package)
```

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, skill/agent list, env prerequisites (no MCP server needed for this lane).
- `assets/skills/http-test-authoring/SKILL.md` — always-installable authoring skill (source of
  truth, Claude-skill format).
- `assets/agents/api-explorer/AGENT.md` — optional authoring agent that requires
  `MULTILANE_TARGET_HOST` and `MULTILANE_APPROVED_HOSTS` to be set (source of truth, Claude-agent
  format).

## Who consumes this package

Not test authors directly. `mlt authoring install` (from `@multilane/cli`) resolves this package
from the consumer project's `node_modules`, reads `lane.manifest.json`, and materializes
tool-specific wrapper files into the consumer repo.

## Runtime isolation

Zero dependencies, no executable test logic, and `@multilane/http`'s `package.json` does not
reference it. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine root for the isolation
proof pattern (same shape as the web lane).
