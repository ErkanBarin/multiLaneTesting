---
name: memory-learning-loop
description: Keep curated repo memory continuously up to date by extracting reusable lessons after each completed task and writing only verified facts to docs/memory/*
---

# Memory Learning Loop

Purpose: make memory updates continuous, not one-time setup.

Use this skill at the end of any non-trivial task that discovered stable facts (routes, frozen
locators, commands, blockers, coverage, traceability, architecture links, or workflow gotchas).

## Core rule

Update memory only with facts that are:
- repeatable
- reusable by future contributors/agents
- verified from source code, docs, or successful command evidence

Never write speculation, temporary debugging chatter, credentials, host literals, or secrets.
Full write rules and entry shape: `docs/memory/README.md`; store/recall/update model:
`docs/memory/memory-system-flow.md`.

## Inputs

Before writing memory, gather:
1. What changed in code/docs
2. What new durable fact was learned
3. Where that fact belongs in memory (`docs/memory/*` — see `docs/memory/agent-query-guide.md`)
4. Source of truth path(s) that verify it
5. Verification date (today)

## Where to write

- Update existing memory files first; create new files only if no suitable index exists.
- Typical targets:
  - `docs/memory/feature-index.md` — domain concepts, oracles, partitions, status semantics
  - `docs/memory/blocker-index.md` — what is unobservable/blocked and why
  - `docs/memory/route-map.md` — targets/screens, channel, status
  - `docs/memory/selector-index.md` — frozen-locator inventory
  - `docs/memory/requirement-index.md` — requirement → lane → spec traceability
  - `docs/memory/source-map.md` — where each kind of truth lives
  - `docs/memory/README.md` — policy changes only

## Write pattern

Each new entry should include:
- concise fact statement
- source path(s)
- last verified date
- status tag (`verified`, `stale`, `blocked`, or `planned`)

Keep entries short and query-friendly.

## Safety filter (must pass all)

Do not write if any is true:
- fact is unverified
- fact depends on private local setup not committed to repo
- fact contains host literals, credentials, tokens, or secrets
- fact is just a one-off conversation detail with no reuse value

## End-of-task routine

After implementation/tests/docs updates, run this loop:
1. Identify reusable lessons from this task.
2. Map each lesson to existing memory file(s).
3. Apply minimal edits in place (no large rewrites); bump "Last verified" only for what you
   actually checked.
4. Ensure no conflict with operational truth docs (`AGENTS.md`, `docs/test-strategy.md`,
   `docs/coverage-map.md`, `docs/traceability.md`, `ARCHITECTURE.md`).
5. If conflict exists, the operational truth doc wins; align memory accordingly.

## Output expectation

When done, report:
- which memory file(s) were updated
- one-line summary per added/changed memory entry
- why the entry is reusable
