You are configuring safe, cost-conscious subagent delegation in this repository.

## Objective

Add low-cost default workers for routine delegated tasks while preserving all
existing specialist agents, specialist skills, routing behavior, and
task-specific model requirements.

The generic low-cost workers are fallback workers for ordinary subagent tasks.
They must not replace or override a matching specialist agent, specialist skill,
or explicit task-level model requirement.

## Preferred default model routing

Repository investigation worker, in priority order:

1. a low-cost general model available in your environment
2. a mid-tier coding model available in your environment

Technical review worker, in priority order:

1. a mid-tier coding model available in your environment
2. a mid-tier coding model available in your environment (fallback)

Concrete model identifiers depend on your AI tooling environment; configure them locally.

Use only exact model identifiers recognized by the current Copilot environment.

If model identifiers cannot be verified:

- Do not silently substitute different models.
- Clearly mark manual verification required.
- State exactly which identifiers remain unverified.
- Preserve the requested model order in the proposed configuration unless doing
  so would make the configuration invalid.

## Non-negotiable rules

- Keep the change minimal and targeted.
- Do not create a new orchestrator or fan-out coordinator.
- Do not modify existing specialist agents that declare their own model policy.
- Do not modify skill files.
- Do not retune, rename, replace, or weaken existing specialist workers.
- Do not remove valid existing workers from an orchestrator allowlist.
- Do not modify README files, memory files, source maps, checklists, or unrelated
  documentation unless necessary for the configuration to function.
- Do not stage or commit files unless explicitly requested.
- Do not claim that worker model configuration is a hard runtime pin.
- An explicit invocation-time model selection has higher priority than worker
  defaults.
- If this repository does not support the required custom-agent configuration,
  report that clearly and do not invent an alternative structure.

## Routing precedence

Apply this routing order:

1. An explicit user or task-level model requirement.
2. A matching specialist skill or specialist agent.
3. An existing domain-specific worker appropriate for the task.
4. The generic low-cost workers added by this task.
5. Evidence-based escalation to a stronger model.

A generic low-cost worker must never replace a matching specialist path merely
because it is cheaper.

Examples:

- A Playwright implementation skill requiring a particular coding model keeps
  its existing route and model behavior.
- A security-review specialist keeps its stronger model if explicitly configured.
- A screen-testing specialist remains responsible for screen-testing work.
- Generic repository mapping with no specialist match routes to the repository
  worker.
- Generic read-only code or test review with no specialist match routes to the
  technical worker.

## Discovery phase

Before editing anything:

1. Detect the repository’s supported agent system and relevant configuration
   locations.

2. Locate:

   - the existing orchestrator or delegation entrypoint
   - all worker agent configurations referenced by it
   - repository-wide Copilot instructions
   - AGENTS.md or equivalent portable instructions
   - specialist agent definitions
   - skill definitions
   - task-specific instructions that mention required models or routing

3. Build a preserve list containing:

   - every specialist agent with explicit model configuration
   - every specialist agent with domain-specific routing
   - every skill or instruction requiring a specific model or agent
   - every existing worker whose purpose overlaps with the proposed generic
     workers
   - every file that must remain unchanged

4. Show the preserve list before describing implementation results.

5. Check for naming collisions:

   - cheap-repository-worker
   - technical-worker

If either name already exists:

- Do not overwrite it automatically.
- Determine whether it already satisfies this specification.
- If it has specialist behavior, explicit model intent, broader permissions, or
  a different purpose, preserve it and report the collision.
- Do not invent a replacement name without explaining the conflict.

## Implementation phase

### A. Orchestrator constraints

Only modify an existing orchestrator.

Ensure:

- its tools include `agent`
- it has an explicit `agents` allowlist
- every allowlist entry exactly matches an agent’s `name` field
- all valid existing specialist workers remain allowed
- the two generic workers are added only when they do not conflict with existing
  specialist definitions
- specialist routing remains ahead of generic routing
- routine unmatched tasks route to the generic low-cost workers
- no unnamed or default inherited-model subagent is preferred for routine work

Do not otherwise broaden or redesign the orchestrator.

If no orchestrator exists:

- Do not create one.
- Report that constrained named delegation cannot be added under the current
  scope.
- Do not pretend that repository-wide instructions alone enforce an allowlist.

### B. Generic repository worker

Create or update only when there is no conflicting specialist worker:

```yaml
---
name: cheap-repository-worker
description: Performs narrow, read-only repository mapping, discovery, documentation review, configuration review, and evidence collection.
model:
  # cheap tier, then coding tier — configure concrete identifiers for your environment
  - <low-cost general model>
  - <mid-tier coding model>
tools:
  - read
  - search
agents: []
user-invocable: false
disable-model-invocation: true
---