# Selector index — frozen-locator inventory (`multilanetesting`)

Compact map of **frozen** locators: area → key → tier → resolver → stability → last verified. The
screen analog of web application's selector-index / `SELECTOR_INVENTORY.md`. The authoritative resolver data
lives under `locators/<area>/`; this file is the queryable summary.

## Inventory

| Area | Key | Tier | Resolver (no host literals) | Stability | Last verified |
|---|---|---|---|---|---|
| <!-- example --> mil-areas | `createButton` | 1 | object id `cwp.milareas.create` | high | — |
| <!-- example --> mil-areas | `areaList` | 1 | UIA role=list name=`Military areas` | high | — |
| <!-- example --> doc-viewer | `nextButton` | 2 | template `next.png` @1920×1080 @100% dark | medium | — |

Tier: **1** = object socket / control tree (preferred) · **2** = image template (DPI/resolution/theme-stamped)
· **(authoring-only)** vision is never recorded as a runtime tier.

Stability: **high** (Tier-1 symbolic id) · **medium** (Tier-2 template — re-verify on theme/DPI change)
· **low** (candidate, not yet trusted — do not ship in a spec).

## Rules

- A spec may only use a locator listed here as **frozen** (tier 1 or 2) with a "Last verified" date.
- Tier-2 rows **must** record DPI, resolution, and theme in the resolver column — they are the pin.
- On drift, do not edit silently: route to `screen-flake-hardening` for a **supervised re-pin**, then
  update this row + the `locators/<area>/` record together.
- Never store screenshots, host literals, or secrets here — only the resolver key/metadata.
