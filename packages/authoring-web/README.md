# @multilane/authoring-web

Web-lane **authoring** assets for `multilanetesting` — the AI-facing skills and agents used to
create, explore, debug, and maintain web/DOM tests. This is a companion package to the web-lane
**runtime** package, [`@multilane/web`](../web/README.md), and is never a dependency of it.

```
@multilane/web            = Web runtime capability (selector factories, browser actions, evidence)
@multilane/authoring-web   = Web skills, agents and metadata (this package)
```

## What's in here

- `lane.manifest.json` — deterministic manifest: lane id, runtime/authoring package names,
  compatibility range, the skills and agents this lane offers, required tools, optional MCP
  servers, and environment prerequisites. See [`docs/reference` of the engine report][report] for
  the full schema.
- `assets/skills/web-test-authoring/SKILL.md` — always-installable authoring skill (source of
  truth, Claude-skill format).
- `assets/agents/ui-explorer/AGENT.md` — optional authoring agent that requires a configured
  Playwright MCP server (source of truth, Claude-agent format).

## Who consumes this package

Not test authors directly. The `mlt authoring install` command (from `@multilane/cli`) resolves
this package from the consumer project's `node_modules`, reads `lane.manifest.json`, and
**materializes** tool-specific wrapper files into the consumer repo (e.g.
`.claude/skills/web-test-authoring/SKILL.md`, `.github/prompts/web-test-authoring.prompt.md`).

## Runtime isolation

This package has **zero dependencies**, ships no executable test logic, and `@multilane/web`'s
`package.json` does not reference it. Installing web authoring assets does not add anything to the
web lane's runtime `import` graph. See `LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md` at the engine
root for the isolation proof.

[report]: ../../LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md
