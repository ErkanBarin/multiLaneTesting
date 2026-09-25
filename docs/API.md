# docs/API.md — the multilanetesting public API

The engine ships as versioned `@multilane/*` packages. No public registry is configured for
these packages; consume them via `npm pack` tarballs with `overrides` (repo README → Dogfooding).
This page is
the contract: **what a consumer may import** and **what is private**. Anything not listed here is an
internal implementation detail and may change without a semver-major bump.

Enforcement: each package's `exports` map exposes **only** the entrypoints below. Deep imports into
`src/**` are blocked by Node's subpath-exports resolution — if it is not re-exported from the package
root, it is private.

## Packages (independently versioned, scope `@multilane`)

| Package | Import when you… | Heavy deps |
|---|---|---|
| `@multilane/core` | need config resolution or the gates programmatically | none |
| `@multilane/cli` | want the `mlt` binary (`verify`, `new`, `create-system`, `authoring`) | none |
| `@multilane/playwright-config` | run the web/DOM lane | `@playwright/test` (peer, optional) |
| `@multilane/web` | write web/DOM specs (selector factories) | `@playwright/test` (peer, optional) |
| `@multilane/http` | write passive HTTP contract checks | none |
| `@multilane/stomp` | write STOMP/WS contract checks | `@stomp/stompjs`, `ws` (peer, optional) |
| `@multilane/screen` | replay frozen screen locators | none |
| `@multilane/snmp-model` | define and validate an emulated SNMP model | none |
| `@multilane/snmp-runtime` | run a loopback SNMP agent or receive traps | `net-snmp` |
| `@multilane/snmp-adapter-selection` | build a model from a selection list and SMI/MIB | `@multilane/snmp-model` |
| `@multilane/authoring-{web,http,stomp,screen,snmp,trap}` | install lane skills and agents | authoring only |

Lanes are **independently installable**: an HTTP-only consumer installs `@multilane/http`
(+`core`/`cli`) and never pulls Playwright or the STOMP stack.

## `@multilane/core`

```js
import {
  loadConfig, assertTestPartition, loadProjectConfig,
  runVerify, printVerifyTable,
  runNoRuntimeAiGate, reportNoRuntimeAi,
  runRobotContractGate, reportRobotContract,
  DEFAULT_RUNTIME_DIRS, DEFAULT_AUTHORING_DIRS, DEFAULT_SPEC_DIR, DEFAULT_CONTRACT_DOC,
  FORBIDDEN_RUNTIME_PATTERNS,
} from '@multilane/core';
```

- `loadConfig(env?)` → `{ web, http, ws, screen }`, every value env-derived with a documented default.
- `assertTestPartition(config)` → throws if the replay partition is `PROD`.
- `loadProjectConfig(cwd?)` → gate/lane settings from optional `multilane.config.json`.
- `runVerify({ cwd? })` → `{ ok, gates: [{ name, ok, detail }] }`.
- `printVerifyTable(result)` → renders the green/red table, returns `ok`.
- Gate functions return structured results; `report*` helpers print and return a boolean.

**Private:** everything under `@multilane/core/src/**` (config internals, gate walkers). Not importable.

## `@multilane/cli`

Primary interface is the `mlt` binary:

```
mlt verify                                  # run the deterministic gates in the current project
mlt new <name> --lanes web,http             # lanes: web, http, stomp, screen, snmp, trap
mlt create-system <name> --lanes web,http   # scaffold AND install authoring assets; exits nonzero if
                                            # an authoring package is unresolvable
```

Programmatic (for tooling/tests):

```js
import { scaffoldProject, SUPPORTED_LANES } from '@multilane/cli';
```

## `@multilane/playwright-config`

```ts
import { definePlaywrightConfig } from '@multilane/playwright-config';
export default definePlaywrightConfig({ testDir: './tests/web' });
```

## `@multilane/web`

```ts
import { selectorFactory } from '@multilane/web';
const ui = selectorFactory(page, { appRoot: 'body', title: 'h1' });
```

## `@multilane/http`

```js
import { getJson, assertShape, assertApprovedHost } from '@multilane/http';
```

Passive only — read-only GET, shape/status assertions, approved-host guard. No state mutation.

## `@multilane/stomp`

```js
import { subscribeOnce, send } from '@multilane/stomp';
```

`subscribeOnce` is passive. `send` (active) refuses unless `inject: true` **and** the host is on the
approved-hosts allowlist.

## `@multilane/screen`

```js
import { loadFrozenLocator, assertFrozen } from '@multilane/screen';
```

Runtime surface loads/validates **frozen** locators only — no discovery, vision, or model.
`driverScriptPath`, `runDriver`, and `openViewer` expose the shipped screen driver; opening a viewer
refuses the operational partition before connecting.

## SNMP model, runtime, and adapter

- `@multilane/snmp-model`: `validateModel(model)` checks an explicit `EmulatedAgentModel`.
- `@multilane/snmp-runtime`: `startEmulatedAgent({ model, port, community })` starts a loopback
  agent; `startTrapListener({ port })` receives notifications on loopback. Both return a `close()`
  method. Supply a per-run community value, never a committed credential.
- `@multilane/snmp-adapter-selection`: `buildSelectionModel({ selectionText, mib })` returns
  `{ model, gaps, debug }`. Pass content or explicit `selectionPath`/`mibPath`; unknown directives
  are reported, never silently treated as complete coverage.

## Versioning

Each workspace versions independently. Check its `package.json` for the current version; a breaking
public signature change requires a version bump. Deep imports are not a supported API.
