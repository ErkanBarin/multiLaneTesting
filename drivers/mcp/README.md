# screen-driver MCP (authoring scaffold)

This folder contains a minimal local MCP stdio server used for authoring-time screen discovery.

## Entry point

- `drivers/mcp/server.ts`

## Mode guard

The server starts only when:

- `SCREEN_DRIVER_MODE=authoring`

If mode is not `authoring`, it exits with a non-zero status.

## Current tools

- `screen_driver.health`
- `screen_driver.describe_authoring_flow`
- `screen_driver.list_channels`
- `screen_driver.freeze_locator_dry_run`

## Scope

This is intentionally authoring-only and does not perform runtime screen control.
Runtime execution remains deterministic replay with frozen locators.
