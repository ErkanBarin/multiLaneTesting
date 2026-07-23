---
name: web-test-authoring
description: Author deterministic Playwright specs for the web/DOM lane using the selector-factory pattern. Always installable — no MCP server or extra tooling required.
user-invocable: true
---

# web-test-authoring

Write and maintain web/DOM specs for the `multilanetesting` web lane. Runtime capability lives in
`@multilane/web` (selector factories over Playwright); this skill is the authoring-time companion —
it never runs as part of a test.

## Procedure

1. **Locate the selector map.** Web specs build a named map of stable selectors and resolve it with
   `selectorFactory(page, map)` from `@multilane/web`. Look for an existing map before inventing new
   selectors — reuse beats rediscovery.
2. **Write one spec per user-observable behavior.** Steps read as user intent and outcome
   (`test.step('user opens…')`, `test.step('user sees…')`), not mechanics (`click`, `waitForSelector`).
3. **Web-first assertions only.** Use Playwright's auto-retrying `expect(locator)...` assertions —
   never a manual `waitForTimeout` or `sleep`. The engine's lint config hard-fails on both.
4. **No mocking of the target.** Assert against the real rendered DOM state; do not stub responses
   the app itself is responsible for producing.
5. **Env-var target only.** Base URL and any target host come from `MULTILANE_WEB_BASE_URL` (or the
   project's `.env`) — never hardcode a host literal in a committed spec.
6. **Evidence.** Rely on the shared Playwright config's trace/screenshot/video settings
   (`@multilane/playwright-config`) rather than ad hoc screenshot calls inside the spec body.

## Guardrails

- No `waitForTimeout`, no `sleep()`, no `test.only`/`describe.only` left in committed specs.
- No host/URL literals — reference the env-var name in comments and code.
- Prefer the existing selector map; only add a new selector when the behavior under test needs one
  that doesn't exist yet, and record it back into the map (not inline in the spec).

## When you need more

- A selector doesn't exist and you need to discover it on a live target → hand off to
  **ui-explorer** (requires the Playwright MCP server configured; see
  `mlt authoring configure web-explorer` if it reports as not enabled).
- A spec is flaky, not missing a selector → that is drift/timing triage, not authoring; treat it as
  a bug in the spec's wait condition first.

## Coding style — ponytail (lazy-first)

When generating specs or helpers, climb this ladder and stop at the first rung that holds:

1. Does this need to exist? Speculative need → skip it, say so in one line. (YAGNI)
2. Already in this codebase? Reuse it — look before you write.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dep solves it? Use it.
6. Can it be one line? Write one line.
7. Only then: the minimum code that works.

Shortest working diff wins. No unrequested abstractions, no boilerplate "for later", deletion over
addition. Mark deliberate shortcuts: `# ponytail: <ceiling>, <upgrade-path>`.
