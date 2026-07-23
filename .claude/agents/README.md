# Claude agents — `multilanetesting`

Source-of-truth specialist personas. The Copilot side wraps these as hidden workers under
`.github/agents/*-worker.agent.md` (see [`CUSTOMIZATION_MAP.md`](../../CUSTOMIZATION_MAP.md)).

| Agent | Role | Color |
|---|---|---|
| [`screen-explorer`](screen-explorer.md) | Discover and freeze locators on a live screen target | cyan |
| [`screen-test-designer`](screen-test-designer.md) | Author deterministic screen specs from frozen locators | green |
| [`screen-flake-debugger`](screen-flake-debugger.md) | Diagnose drift/flake; supervised re-pin | orange |
| [`repo-keeper`](repo-keeper.md) | Validate types, structure, no-runtime-AI, memory sync | purple |

## Handoff flow

```
screen-explorer  →  screen-test-designer  →  repo-keeper
        ↑                                         │
        └──────── screen-flake-debugger ◄─────────┘   (on failure / drift)
```

Discovery → authoring → validation. `screen-flake-debugger` enters on failure or locator drift.
The **only** difference from `a DOM-focused test suite` is the discovery surface: **screen, not DOM**.

## Invocation

When to call an agent is governed by `AGENTS.md → "Skill and agent invocation"`. How an agent works
is defined in its file here. Slash form (`/screen-explorer`) invokes directly; a description match
invokes automatically.
