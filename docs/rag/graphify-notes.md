# RAG / knowledge graph notes — `multilanetesting`

This framework reuses the web application pattern: a **knowledge graph** built from the repo (code via AST,
docs/images via semantic extraction) that agents query instead of grepping file-by-file.

## Why

- ~20× fewer tokens than reading source files for architecture / traceability / cross-feature questions.
- Persistent: god nodes, community detection, query / path / explain.
- Complements `docs/memory/*` — memory is the curated human-written index; the graph is the
  machine-built index over everything.

## When it exists (`graphify-out/graph.json`)

- Prefer `graphify query "<question>"` (or the `graphify` MCP tools) over manual search for:
  architecture, which spec covers requirement X, what depends on driver Y, cross-area impact.
- Fall back to `docs/memory/*` and direct file reads when the graph is absent or the question is
  narrow and local.

## Building / refreshing

1. Generate once the repo has real content: `/graphify .` (or the CLI equivalent).
2. Refresh after merging significant changes: `/graphify . --update`.
3. Commit `graphify-out/` (graph.json, manifest, report) so agents share one graph; keep the cache
   out of large diffs if it bloats.

## Guardrails

- The graph is **read-only context**, not memory. Durable conclusions still get written to
  `docs/memory/*` per the write rules.
- Never let the graph builder ingest `.env`, secrets, or transcript logs — keep them gitignored and
  out of scope.

> Until the graph is built, this file is a placeholder describing the intended setup. No `graphify-out/`
> ships in the starter kit.
