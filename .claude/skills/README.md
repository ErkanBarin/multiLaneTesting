# Claude skills — `multilanetesting`

Source-of-truth reusable workflows. Copilot prompts under `.github/prompts/` are thin wrappers around
these bodies (see [`CUSTOMIZATION_MAP.md`](../../CUSTOMIZATION_MAP.md)).

| Skill | Purpose |
|---|---|
| [`orchestrate`](orchestrate/SKILL.md) | Route a task to the lightest effective execution path |
| [`screen-exploration`](screen-exploration/SKILL.md) | Explore a screen target; discover and freeze locators |
| [`screen-test-implementation`](screen-test-implementation/SKILL.md) | Implement a deterministic screen spec in repo style |
| [`screen-flake-hardening`](screen-flake-hardening/SKILL.md) | Diagnose and fix flaky/drifted screen specs |
| [`screen-operator`](screen-operator/SKILL.md) | Route screen/browser work across driver, MCP, and Playwright |
| [`pr-hygiene`](pr-hygiene/SKILL.md) | PR readiness checklist (incl. host-literal sanitization) |

## Invocation

Governed by `AGENTS.md → "Skill and agent invocation"`: description match → invoke; slash overrides
matching; ambiguity → ask; no match → improvise; `orchestrate` is the meta-router.
