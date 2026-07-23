# Copilot prompts — `multilanetesting`

Slash-command wrappers. Each is a thin Copilot adapter around a Claude-side source of truth (a skill
in `.claude/skills/` or an agent in `.claude/agents/`). See
[`CUSTOMIZATION_MAP.md`](../../CUSTOMIZATION_MAP.md).

| Prompt | Wraps | Purpose |
|---|---|---|
| [`/orchestrate`](orchestrate.prompt.md) | `orchestrate` skill / `orchestrator` agent | Route to the lightest path |
| [`/screen-explorer`](screen-explorer.prompt.md) | `screen-explorer` agent / `screen-exploration` skill | Discover and freeze locators |
| [`/screen-test-designer`](screen-test-designer.prompt.md) | `screen-test-designer` agent / `screen-test-implementation` skill | Author a deterministic spec |
| [`/screen-flake-debugger`](screen-flake-debugger.prompt.md) | `screen-flake-debugger` agent / `screen-flake-hardening` skill | Fix drift/flake |
| [`/repo-keeper`](repo-keeper.prompt.md) | `repo-keeper` agent / `pr-hygiene` skill | Validate + memory sync |
| [`/screen-memory-recall`](screen-memory-recall.prompt.md) | recall policy in `AGENTS.md` | Read-only context loader |

All prompts return: **A.** one-line goal · **B.** what was done/built · **C.** what was deferred ·
**D.** the exact next prompt or validation command.
