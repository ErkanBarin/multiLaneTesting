# Customization Map — `multilanetesting`

How the Claude-side source of truth mirrors to the Copilot-side wrapper layer, and which files are
asymmetric by design. Same model as `a DOM-focused test suite`.

## Wrap pattern

The **Claude side is the source of truth** for AI-customization *content*; the Copilot side is a thin
wrapper that adds tool-specific framing only.

- `.claude/skills/<name>/SKILL.md` — canonical workflow body (rules, references, examples).
- `.claude/agents/<name>.md` — canonical specialist persona (role, scope, handoff).
- `.github/prompts/<name>.prompt.md` (~20–30 lines) — Copilot slash-command that links back to the
  matching skill/agent and adds Copilot framing only (`agent`, `tools`, `argument-hint`, fixed
  return shape), when native skill discovery is insufficient.
- `.github/agents/<name>-worker.agent.md` (~15 lines) — hidden Copilot worker that wraps the Claude
  agent.

When you change a skill or agent body on the Claude side, the Copilot wrapper picks it up
automatically — no second edit needed.

## Mirror table

| Concern | Claude (source of truth) | Copilot (wrapper) |
|---|---|---|
| Discovery / exploration | `.claude/agents/screen-explorer.md` | `.github/agents/screen-explorer-worker.agent.md` + `.github/prompts/screen-explorer.prompt.md` |
| Authoring specs | `.claude/agents/screen-test-designer.md` | `.github/agents/screen-test-designer-worker.agent.md` + `.github/prompts/screen-test-designer.prompt.md` |
| Flake / drift | `.claude/agents/screen-flake-debugger.md` | `.github/agents/screen-flake-debugger-worker.agent.md` + `.github/prompts/screen-flake-debugger.prompt.md` |
| Repo hygiene / memory sync | `.claude/agents/repo-keeper.md` | `.github/agents/repo-keeper-worker.agent.md` + `.github/prompts/repo-keeper.prompt.md` |
| Exploration workflow | `.claude/skills/screen-exploration/SKILL.md` | (invoked by the explorer prompt) |
| Spec implementation | `.claude/skills/screen-test-implementation/SKILL.md` | (invoked by the designer prompt) |
| Flake hardening | `.claude/skills/screen-flake-hardening/SKILL.md` | (invoked by the flake prompt) |
| Browser/screen tool routing | `.claude/skills/screen-operator/SKILL.md` | (referenced by prompts) |
| PR readiness | `.claude/skills/pr-hygiene/SKILL.md` | `.github/prompts/repo-keeper.prompt.md` |
| Meta-routing | `.claude/skills/orchestrate/SKILL.md` | `.github/agents/orchestrator.agent.md` + `.github/prompts/orchestrate.prompt.md` |
| Memory recall | (policy in `AGENTS.md`) | `.github/prompts/screen-memory-recall.prompt.md` |
| Memory learning loop | `.claude/skills/memory-learning-loop/SKILL.md` | `.github/prompts/memory-learning-loop.prompt.md` |

## Asymmetric by design

- **`orchestrator.agent.md`** is **Copilot-only** (user-facing entrypoint). Claude routes via the
  `orchestrate` skill instead.
- **`screen-memory-recall.prompt.md`** is **Copilot-only**; the recall policy itself lives in
  `AGENTS.md` and is followed natively by Claude.
- **Ponytail** is supplied by the user-level plugin. `BOOTSTRAP_PROMPT.md` installs it from
  `DietrichGebert/ponytail` for GitHub Copilot CLI; repository-local Ponytail skills and prompts
  are intentionally absent because they would duplicate the plugin's slash-command tree.
- **Graphify** is an external `graphifyy` tool installed by `BOOTSTRAP_PROMPT.md`, not a
  repository-local skill. Use `/graphify` when the host exposes its skill, or the `graphify` CLI.
- **`CLAUDE.md`** (repo root) is **Claude-only and gitignored** — local operational truth.

## Invocation policy

Lives in `AGENTS.md → "Skill and agent invocation"` and is identical across tools: description match
→ invoke; slash overrides matching; ambiguity → ask; no match → improvise; `orchestrate` is the
meta-router. Do not duplicate the policy here — point to `AGENTS.md`.

## Packaged lane authoring assets (distributed to consumers)

Everything above is engine-repo-local customization (`.claude/`, `.github/` here). A second,
**distributable** copy of the same wrap pattern ships to consumer projects via
`@multilane/authoring-<lane>` packages and the `mlt authoring install` CLI — see
[`LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md`](LANE_AUTHORING_TOOLKIT_IMPLEMENTATION.md) for the full
design. Same convention, reused: the Claude-format file is the source of truth
(`assets/skills/<id>/SKILL.md`, `assets/agents/<id>/AGENT.md` inside the authoring package);
`mlt authoring install` generates the Copilot wrapper (`.github/prompts/*.prompt.md`,
`.github/agents/*-worker.agent.md`) in the **consumer's** repo, not this one. This repo's own
`.claude`/`.github` content is not currently re-packaged for distribution — only the purpose-built
`packages/authoring-{web,http,stomp}` assets are (see the report's portability matrix for why the
existing screen-lane agents/skills are engine-maintainer-only today; `screen` is the only lane
without an authoring package).
