---
name: memory-learning-loop
description: Update docs/memory continuously with verified reusable lessons from the current task
tools: ["read", "search", "edit"]
---

# /memory-learning-loop

Source of truth: [`.claude/skills/memory-learning-loop/SKILL.md`](../../.claude/skills/memory-learning-loop/SKILL.md).

Run the memory learning loop after completing the current task:

1. Read current `docs/memory/*` and identify the best existing destination file(s)
   (`docs/memory/agent-query-guide.md` maps question → index).
2. Extract only reusable, repeatable, verified lessons from work completed in this task.
3. Update memory files in place (minimal diffs, no bulk rewrite).
4. Include source references and a "Last verified" date on each new/updated entry.
5. Exclude secrets, host literals, and temporary debugging chatter.
6. If any memory statement conflicts with operational-truth docs, align to operational truth.

**Return:** updated files list · added/changed entries (1 line each) · why each is reusable.
