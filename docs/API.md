# docs/API.md — the multilanetesting public API

The engine ships as versioned `@erkanbarin/*` packages on the public npm registry. This page is
the contract: **what a consumer may import** and **what is private**. Anything not listed here is an
internal implementation detail and may change without a semver-major bump.

Enforcement: each package's `exports` map exposes **only** the entrypoints below. Deep imports into
`src/**` are blocked by Node's subpath-exports resolution — if it is not re-exported from the package
root, it is private.

## Packages (independently versioned, scope `@erkanbarin`)

| Package | Import when you… | Heavy deps |
|---|---|---|
| `@erkanbarin/core` | need config resolution or the gates programmatically | none |
| `@erkanbarin/cli` | want the `mlt` binary (`verify`, `new`, `create-system`, `authoring`) | none |
| `@erkanbarin/playwright-config` | run the web/DOM lane | `@playwright/test` (peer, optional) |
| `@erkanbarin/web` | write web/DOM specs (selector factories) | `@playwright/test` (peer, optional) |
| `@erkanbarin/http` | write passive HTTP contract checks | none |
| `@erkanbarin/stomp` | write STOMP/WS contract checks | `@stomp/stompjs`, `ws` (peer, optional) |
| `@erkanbarin/screen` | replay frozen screen locators | none |
| `@erkanbarin/snmp-model` | define and validate an emulated SNMP model | none |
| `@erkanbarin/snmp-runtime` | run a loopback SNMP agent or receive traps | `net-snmp` |
| `@erkanbarin/snmp-adapter-selection` | build a model from a selection list and SMI/MIB | `@erkanbarin/snmp-model` |
| `@erkanbarin/authoring-{web,http,stomp,screen,snmp,trap}` | install lane skills and agents | authoring only |

Lanes are **independently installable**: an HTTP-only consumer installs `@erkanbarin/http`
(+`core`/`cli`) and never pulls Playwright or the STOMP stack.

## `@erkanbarin/core`

```js
import {
  loadConfig, assertTestPartition, loadProjectConfig,
  runVerify, printVerifyTable,
  runNoRuntimeAiGate, reportNoRuntimeAi,
  runRobotContractGate, reportRobotContract,
  DEFAULT_RUNTIME_DIRS, DEFAULT_AUTHORING_DIRS, DEFAULT_SPEC_DIR, DEFAULT_CONTRACT_DOC,
  FORBIDDEN_RUNTIME_PATTERNS,
} from '@erkanbarin/core';
```

- `loadConfig(env?)` → `{ web, http, ws, screen }`, every value env-derived with a documented default.
- `assertTestPartition(config)` → throws if the replay partition is `PROD`.
- `loadProjectConfig(cwd?)` → gate/lane settings from optional `multilane.config.json`.
- `runVerify({ cwd? })` → `{ ok, gates: [{ name, ok, detail }] }`.
- `printVerifyTable(result)` → renders the green/red table, returns `ok`.
- Gate functions return structured results; `report*` helpers print and return a boolean.

**Private:** everything under `@erkanbarin/core/src/**` (config internals, gate walkers). Not importable.

## `@erkanbarin/cli`

Primary interface is the `mlt` binary:

```
mlt verify                                  # run the deterministic gates in the current project
mlt new <name> --lanes web,http             # lanes: web, http, stomp, screen, snmp, trap
mlt create-system <name> --lanes web,http   # scaffold AND install authoring assets; exits nonzero if
                                            # an authoring package is unresolvable
```

Programmatic (for tooling/tests):

```js
import { scaffoldProject, SUPPORTED_LANES } from '@erkanbarin/cli';
```

## `@erkanbarin/playwright-config`

```ts
import { definePlaywrightConfig } from '@erkanbarin/playwright-config';
export default definePlaywrightConfig({ testDir: './tests/web' });
```

## `@erkanbarin/web`

```ts
import { selectorFactory } from '@erkanbarin/web';
const ui = selectorFactory(page, { appRoot: 'body', title: 'h1' });
```

## `@erkanbarin/http`

```js
import { getJson, assertShape, assertApprovedHost } from '@erkanbarin/http';
```

Passive only — read-only GET, shape/status assertions, approved-host guard. No state mutation.

## `@erkanbarin/stomp`

```js
import { subscribeOnce, send } from '@erkanbarin/stomp';
```

`subscribeOnce` is passive. `send` (active) refuses unless `inject: true` **and** the host is on the
approved-hosts allowlist.

## `@erkanbarin/screen`

```js
import { loadFrozenLocator, assertFrozen } from '@erkanbarin/screen';
```

Runtime surface loads/validates **frozen** locators only — no discovery, vision, or model.
`driverScriptPath`, `runDriver`, and `openViewer` expose the shipped screen driver; opening a viewer
refuses the operational partition before connecting.

## SNMP model, runtime, and adapter

- `@erkanbarin/snmp-model`: `validateModel(model)` checks an explicit `EmulatedAgentModel`.
- `@erkanbarin/snmp-runtime`: `startEmulatedAgent({ model, port, community })` starts a loopback
  agent; `startTrapListener({ port })` receives notifications on loopback. Both return a `close()`
  method. Supply a per-run community value, never a committed credential.
- `@erkanbarin/snmp-adapter-selection`: `buildSelectionModel({ selectionText, mib })` returns
  `{ model, gaps, debug }`. Pass content or explicit `selectionPath`/`mibPath`; unknown directives
  are reported, never silently treated as complete coverage.

## Versioning

Each workspace versions independently. Check its `package.json` for the current version; a breaking
public signature change requires a version bump. Deep imports are not a supported API.
