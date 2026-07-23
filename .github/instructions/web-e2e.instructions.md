---
applyTo: "tests/web/**"
description: Path-scoped guidance for the optional web/DOM lane — only for targets that expose a real DOM. Uses Playwright, not the screen driver.
---

# Web/DOM lane (optional)

Applies to `tests/web/**`. Use this lane **only** when the target exposes a real DOM. Anything
screen-only (screen-only HMI, COTS, desktop application over VNC/RDP) belongs to the screen-driver lane, not here.

- Use **Playwright** + the selector-factory pattern (`selectors/<area>.ts` returning named `Locator`s).
  No page-object classes, no `data-testid` unless the app already ships them.
- Web-first assertions only. No `waitForTimeout`/sleeps. No mocking against the live app.
- No host literals — `baseURL` and env-var names only.
- Tests read as short user scenarios with `test.step()` named in user-intent terms.
- Do **not** reimplement DOM testing on the screen driver, and do not bring vision/computer-use here.
