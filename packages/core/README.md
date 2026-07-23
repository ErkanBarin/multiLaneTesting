# @multilane/core

Deterministic engine core for **multilanetesting**: the config loader and the CI gates that keep a
consumer project honest. No runtime AI, no host literals, no build step.

## Install

```bash
npm install --save-dev @multilane/core
```

(Installs from your configured npm registry — see the root `.npmrc.sample`.)

## Public API

Only the `.` entry is public; everything else is private engine internals.

```js
import {
  loadConfig,          // resolve target-facing config from env (documented defaults)
  assertTestPartition, // throw if replay would hit PROD
  loadProjectConfig,   // read optional multilane.config.json (gate/lane settings)
  runVerify,           // run every deterministic gate, return a structured result
  printVerifyTable,    // render that result as a green/red table
  runNoRuntimeAiGate,  // the no-runtime-AI guard as a function
  runRobotContractGate,// the @tag-contract guard as a function
} from '@multilane/core';
```

### Config resolution

`loadConfig(env)` returns `{ web, http, ws, screen }`. Every value is an env var with a documented
default — see the repo `.env.example`. `assertTestPartition` enforces the
deterministic-world rule (never `PROD`).

### Gates

`runVerify({ cwd })` runs the `no-runtime-ai` and `robot-contract` gates and returns
`{ ok, gates: [{ name, ok, detail }] }`. The `mlt verify` CLI is a thin wrapper over this.

Tune scan roots and the Robot `@tag` allowlist with a `multilane.config.json` at the project root:

```json
{
  "specDir": "tests",
  "runtimeDirs": ["drivers", "tests", "apps"],
  "robotTags": ["@samplePanelCrud"]
}
```
