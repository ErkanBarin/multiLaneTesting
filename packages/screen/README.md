# @multilane/screen

Screen-driver lane for multilanetesting. The **runtime** surface only loads and validates *frozen*
locators — there is no discovery, vision, or model in the run path (that is authoring-only).

```js
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';

const locator = loadFrozenLocator('example', 'appTitle'); // locators/example/appTitle.json
const { ok, errors } = assertFrozen(locator);             // Tier 1/2 + resolver + requirement_ref
```

**Safety-critical guard, not a default.** Every `loadFrozenLocator` call asserts
`SCREEN_RPS_PARTITION` is not `PROD` and throws if it is — the refusal is baked into the runtime
entry point itself, so it holds even if a spec runs outside `mlt verify` (which also runs this
same check as a hard-failing gate before any lane starts).

Actuation (input synthesis, capture, and the three oracles) lives in the deterministic Python driver
(`pyproject.toml`); this package is the locator contract your specs replay against. Replay always
targets a **test partition** (`TEST_A`/`TEST_B`/`TEST_C`), never `PROD`.
