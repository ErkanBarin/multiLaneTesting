# Route map — `multilanetesting`

Screens/targets under test, their **functional channel**, and status. Replace example rows with verified entries.

## Targets

| Target | Surface | Functional channel | Test partition | Status | Last verified |
|---|---|---|---|---|---|
| <!-- example --> screen-only HMI — sample panel editor | VNC | Tier-1 object socket (`app.samplePanel.*`) | `TEST_A` | `not-started` | — |
| <!-- example --> desktop application — data list | RDP | Tier-1 native UI automation (UIA) | `TEST_B` | `not-started` | — |
| <!-- example --> COTS viewer — document pane | VNC | Tier-2 template (DPI/theme-stamped) | `TEST_C` | `not-started` | — |
| <!-- example --> Web console (if any DOM) | Browser | Playwright DOM (web lane) | n/a | `not-started` | — |

Status values: `not-started` · `exploring` · `frozen` (locators pinned) · `covered` (spec passing ×2)
· `blocked` (see `blocker-index.md`).

## Notes

- A target appears here **before** any locator is frozen — discovery starts from this map.
- The functional channel column decides the driver tier: object socket / control tree → Tier 1; framebuffer
  only → Tier 2. DOM targets do **not** belong to the screen driver — use the web lane.
- Never record host/IP literals here. Reference the env-var name (`SCREEN_TARGET_HOST`) instead.
