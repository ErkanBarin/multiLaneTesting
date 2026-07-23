# Memory — `multilanetesting`

Compact, curated repo memory. **Query this layer first**, before operational truth docs or the
heavyweight reference. This is *curated* memory — only verified, reusable facts that change future
decisions. It is **not** an automatic transcript log.

Full store/recall/update model: [`memory-system-flow.md`](memory-system-flow.md).

## What's here

| File | Answers |
|---|---|
| [`route-map.md`](route-map.md) | Which targets/screens exist, their channel, status |
| [`selector-index.md`](selector-index.md) | Frozen-locator inventory (area → key → tier → resolver → verified) |
| [`feature-index.md`](feature-index.md) | Domain concepts, oracles, partitions, status semantics |
| [`blocker-index.md`](blocker-index.md) | What is unobservable/blocked and why (honestly) |
| [`requirement-index.md`](requirement-index.md) | Requirement → lane → spec traceability shortcuts |
| [`source-map.md`](source-map.md) | Where each kind of truth lives (which doc/file) |
| [`agent-query-guide.md`](agent-query-guide.md) | Which index to read for which question |

## Retrieval order (canonical in `AGENTS.md`)

1. `docs/memory/*` — this layer.
2. Operational truth — `docs/test-strategy.md`, `docs/coverage-map.md`, `docs/traceability.md`,
   `locators/` inventory, `ARCHITECTURE.md`.
3. `docs/reference/*` — heavyweight source docs, only when 1–2 are insufficient.
4. Tool-local memory/logs — local, read-only, **never authoritative**.

## Write rules (short form)

- Store facts that change future decisions: new targets, frozen locators, blockers, coverage,
  traceability. Keep entries compact with **Feature/route · Status · Exact path · Blocker/guardrail ·
  Last verified**.
- **Never** store transcripts, secrets/tokens, `.env` values, host/IP literals, temporary notes, or
  unverified assumptions.
- Update the relevant index on every closeout; bump "Last verified" only for what you actually checked.
- If an index disagrees with operational truth, operational truth wins — fix the index.

> These files ship as **seed scaffolds**. Replace the `<!-- example -->` rows with real, verified
> entries as the framework is built out. Do not leave example rows in once real data exists.
