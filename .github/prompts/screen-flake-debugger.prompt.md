---
name: screen-flake-debugger
description: Diagnose and fix a flaky or drifted screen spec without weakening assertions or adding runtime AI. Classifies locator drift, synchronization, non-deterministic fixture, rendering-oracle noise, or real defect, then applies the matching fix (supervised Tier-4 re-pin for genuine drift).
argument-hint: <failing spec path or symptom, e.g. "tests/mil-areas/create.spec flaps in CI">
agent: screen-flake-debugger-worker
tools: ["read", "search", "edit", "execute"]
---

# /screen-flake-debugger

Source of truth: [`.claude/agents/screen-flake-debugger.md`](../../.claude/agents/screen-flake-debugger.md)
+ [`.claude/skills/screen-flake-hardening/SKILL.md`](../../.claude/skills/screen-flake-hardening/SKILL.md).

Pull the run evidence (functional-channel readback + golden-image diff + logs) and **classify before
editing**: locator drift → supervised Tier-4 re-pin (human-approved); synchronization → wait on the
object channel, never `sleep`; non-deterministic fixture → fix RPS scenario/partition; rendering
noise → mask the volatile region; genuine functional failure → record a defect, not a flake.

Re-run **twice**; require identical functional readback. Never add `sleep`/retry, never add a runtime
vision call, never re-pin silently, never downgrade the functional oracle.

**Return:** A. one-line goal · B. root cause + fix · C. follow-ups deferred · D. validation command.
