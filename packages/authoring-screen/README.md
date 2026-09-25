# @multilane/authoring-screen

Screen-lane **authoring** assets for `multilanetesting` — the AI-facing skills and agents used to
explore a screen-only target, freeze Tier-1/2 locators, and write deterministic replay specs.
Companion package to the screen-lane **runtime** package,
[`@multilane/screen`](../screen/README.md), and never a dependency of it.

```
@multilane/screen            = screen runtime capability (loadFrozenLocator, assertFrozen, runDriver, openViewer)
@multilane/authoring-screen  = screen skills, agents, the screen-driver MCP server and metadata (this package)
```

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, skill/agent list, `screen-driver` MCP prerequisite, env prerequisites.
- `assets/skills/` — four always-installable authoring skills (source of truth, Claude-skill format):
  `screen-operator` (surface routing), `screen-exploration` (discover + freeze),
  `screen-test-implementation` (write the spec), `screen-flake-hardening` (drift and flake).
- `assets/agents/` — three optional authoring agents, each requiring the `screen-driver` MCP server:
  `screen-explorer`, `screen-test-designer`, `screen-flake-debugger`.
- `mcp/server.mjs` — that MCP server, as the `multilane-screen-mcp` bin (0.2.0+).

## Safety-critical

Screen replay targets a **test partition** — `TEST_A`, `TEST_B`, or `TEST_C` — and **never `PROD`**, the
operational partition. Every skill and agent here states it. `@multilane/screen` enforces it at the
runtime entry point (`loadFrozenLocator` refuses when `SCREEN_RPS_PARTITION` resolves to `PROD`);
this package's job is to make sure nothing authored here tries to work around that refusal.

## Who consumes this package

Not test authors directly. `mlt authoring install` (from `@multilane/cli`) resolves this package
from the consumer project's `node_modules`, reads `lane.manifest.json`, and materializes
tool-specific wrapper files into the consumer repo. The three agents only materialize once the
`screen-driver` MCP server is configured — run `mlt authoring configure screen-explorer` for the
exact steps.

## The screen-driver MCP server

An authoring agent's hands on the target. It wraps the deterministic driver scripts from
`@multilane/screen` (0.2.0+), which it uses from the project's own install. It is optional: it is a
peer dependency and is never installed for you. `mlt authoring configure screen-explorer` prints this
entry:

```json
"screen-driver": {
  "command": "npx",
  "args": ["--no-install", "multilane-screen-mcp"],
  "env": { "SCREEN_DRIVER_MODE": "authoring" }
}
```

| Tool | |
| --- | --- |
| `screen_driver_health` | partition, open viewer, and both driver `doctor`s: what this host cannot do and what to install |
| `screen_driver_open_viewer` / `_close_viewer` | a VNC/RDP target on a local display for the session (`openViewer`, same environment variables) |
| `screen_driver_atspi` | Tier 1: `dump_tree`, `read`, `read_cell`, `extents`, `do_action`, … |
| `screen_driver_framebuffer` | `find`, `ocr` (words with boxes), `compare`, `click`, `move`, `type`, `key` |
| `screen_driver_capture_template` | cuts `locators/<area>/<key>.png` and proves it matches in exactly one place; an ambiguous cut is deleted |
| `screen_driver_freeze_locator` | validates a record (Tier 2 needs an existing template and a resolution stamp); dry run by default, then writes `locators/<area>/<key>.json` for review |
| `screen_driver_describe_authoring_flow`, `screen_driver_list_channels` | the flow and the channels, for orientation |

It refuses to start unless `SCREEN_DRIVER_MODE=authoring`. Every tool that reaches the target refuses
`PROD`. It returns text and file paths, never pixels, so no screenshot leaves the machine.

## Runtime isolation

No runtime dependencies, no executable test logic, and `@multilane/screen`'s `package.json` does not
reference it. The MCP server is authoring-time only; it depends on the runtime package, never the
reverse. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine root for the isolation
proof pattern (same shape as the web, HTTP, and STOMP lanes).
