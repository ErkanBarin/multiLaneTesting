---
name: multilane-setup
description: Inspect a repo for testable surfaces, then set up multilane testing — scaffold a test project with the selected lanes from npm, install the runtimes, and install the lane authoring skills and agents. Use when someone wants to start writing multilane tests, or a multilane import or `mlt` command fails because the project was never set up.
---

# multilane-setup

Get a repo from nothing to a runnable multilane test project: recommend lanes from evidence,
scaffold a new child project, install the `@erkanbarin/*` runtimes from npm, install the lane
authoring skills and agents into that project, and report what the user still has to provide.
Teams supply approved targets and credentials; this skill never connects to a live target.

Run it once per project. Afterwards, use the lane authoring skills it installs
(`web-test-authoring`, `http-test-authoring`, `screen-exploration`, …) to write tests.

## 1. Pick the lanes

Read the current repo's README, package/config files, existing tests, and any API, MIB/SNMP, or
UI documentation. Report which target surfaces the evidence supports; an import or a client
config alone does not prove a live interface. Honor lanes the user named.

| Lane | Use when the target… |
|---|---|
| `web` | renders a real DOM (Angular, React, any browser app) |
| `http` | exposes a REST/JSON API you want shape-checked |
| `stomp` | pushes over WebSocket/STOMP |
| `screen` | renders to a framebuffer — VNC/RDP, C++ HMI, COTS; no DOM |
| `snmp` | answers SNMP GET/WALK |
| `trap` | emits SNMP traps you want to capture |

Pick the smallest set that covers the target; lanes can be added later, and an `http`-only
project never pulls Playwright. If the lanes and location are clear, continue through step 5
without asking again. If no lane is substantiated, or the choice between plausible lanes would
change the setup, ask one short question first. Default to a new, non-existing child folder;
never overwrite an existing test project.

## 2. Check the toolchain and registry

```bash
node --version    # must be 20 or later
npm --version     # must be 10 or later
npm view @erkanbarin/cli version
```

If Node or npm is too old, stop and say so. If `npm view` hangs or fails, the network probably
blocks the public npm registry: ask the user for their proxy (`npm config set proxy` /
`https-proxy`) or internal npm mirror (`npm config set registry`) rather than guessing. Do not add
auth tokens — the packages are public. Fallback without any registry: clone
`https://github.com/ErkanBarin/multiLaneTesting`, run `npm ci`, scaffold with
`node <clone>/packages/cli/bin/mlt.mjs new …`, and install with
`node <clone>/scripts/install-tarballs.mjs <project>` instead of `npm install` in step 4.

## 3. Scaffold

```bash
npx -y @erkanbarin/cli new <project-name> --lanes <comma-separated lanes>
```

Always use `mlt new`; never hand-write the scaffold. It emits the config skeleton, `locators/`,
one example spec per lane, `.env.example`, a comment-only `.npmrc`, an optional `Jenkinsfile`,
and exact dependency pins that match the published engine.

## 4. Install and verify

In the generated project:

```bash
npm install
npx playwright install chromium   # web lane only
npx mlt verify
env -u MULTILANE_WEB_BASE_URL -u MULTILANE_TARGET_HOST -u MULTILANE_WS_URL -u SCREEN_TARGET_HOST \
  -u SCREEN_RPS_PARTITION npm run test:<lane>     # once per selected lane
python3 node_modules/@erkanbarin/screen/driver/atspi_bridge.py doctor   # screen: Linux Qt/GTK targets
python3 node_modules/@erkanbarin/screen/driver/framebuffer.py doctor    # screen: VNC/RDP/framebuffer targets
```

`mlt verify` runs the static gates only (`no-runtime-ai`, `robot-contract`, `screen-partition`).
The `web`, `http` and `stomp` example specs **skip** while naming their missing target variable —
that is expected, not a failure. The `screen`, `snmp` and `trap` examples need no target and must
pass. Commit the generated `package-lock.json` so CI can run `npm ci`.

For `screen`, run `doctor` with system `python3` on the machine that will run screen tests. Gate
each needed capability on its key (`can_read`, `can_actuate_menus`, `can_capture`, `can_input`,
`can_ocr`, …). A failing check names system packages this skill cannot install — report them.

## 5. Install the lane authoring skills and agents

```bash
npm install --save-dev --save-exact @erkanbarin/authoring-<lane> …   # one per selected lane
npx --no-install mlt authoring install --lanes <comma-separated lanes>
npx --no-install mlt authoring check
```

This writes the lane skills and explorer agents into the project's `.claude/` and `.github/`, with
provenance so `mlt authoring update` can refresh them after an engine upgrade. They are
authoring-time only; nothing they add runs in a test.

## 6. Report what each lane still needs

Target values come only from the environment. Nothing loads `.env` automatically: the user copies
`.env.example` to `.env`, fills it in, and exports it (`set -a; . ./.env; set +a`). Never guess a
host and never commit one.

| Lane | Example spec skips until set | Live checks and explorers need |
|---|---|---|
| `web` | `MULTILANE_WEB_BASE_URL` | `MULTILANE_WEB_BASE_URL` |
| `http` | `MULTILANE_TARGET_HOST` (full base URL) | plus `MULTILANE_APPROVED_HOSTS`, `MULTILANE_API_CONTRACT=1` |
| `stomp` | `MULTILANE_WS_URL` | plus `MULTILANE_APPROVED_HOSTS`, `MULTILANE_WS_CONTRACT=1` |
| `screen` | nothing — validates a frozen locator | `SCREEN_TARGET_HOST`, `SCREEN_RPS_PARTITION` (default `TEST_A`; `PROD` is refused) |
| `snmp` | nothing — bundled emulator | `MULTILANE_SNMP_HOST`, `MULTILANE_SNMP_COMMUNITY`, `MULTILANE_SNMP_CONTRACT=1` |
| `trap` | nothing — emulated sender on loopback | `MULTILANE_TRAP_PORT`, `MULTILANE_TRAP_BIND` |

`MULTILANE_APPROVED_HOSTS` is not a runtime safety boundary for passive calls (an empty list allows
HTTP GETs with a warning); set it before live exploration. Active STOMP SEND fails closed on an
empty list.

The generated `Jenkinsfile` assumes a team-configured `multilane-jenkins` shared library and a real
agent label; report CI as not configured.

## 7. Optional live-exploration agents

Authoring skills work without MCP. Configure MCP only if the user wants an agent to inspect a live
target, ask before changing MCP config, and preserve existing servers.

- `web`: `ui-explorer` needs a server named `playwright` in `.mcp.json` (`mcpServers`) or
  `.vscode/mcp.json` (`servers`):
  `{"command": "npx", "args": ["-y", "@playwright/mcp@latest", "--browser", "chromium"]}`.
  Report it as configured but unverified until a session opens the browser.
- `screen`: `npx --no-install mlt authoring configure screen-explorer` prints the `screen-driver`
  MCP entry (served by `@erkanbarin/authoring-screen`). On Linux Qt/GTK targets the AT-SPI driver
  also works without MCP when `doctor` reports `can_read`. A healthy MCP does not prove target
  access.
- `http`, `stomp`, `snmp`, `trap`: no MCP; their explorers need the step 6 values.

Report readiness per lane: runtime installed, browser (web), `mlt verify` result, `test:<lane>`
result (passed, or skipped naming a variable), screen `doctor` result, authoring assets installed,
missing target values, and MCP status. Do not call a lane ready for live exploration while its
driver, MCP server, or target values are missing.

## 8. First real test

If the user gave a concrete behavior and its requirement source, use the lane's authoring skill to
write one test and run `npm run test:<lane>`. Otherwise ask for it — example specs only prove
local wiring.

## Rules

- Never vendor `@erkanbarin/*` source into the consumer repo; it is a versioned dependency.
- Never commit a token, a host, or a `.env`.
- If a lane's target is missing, leave it skipping and say so; never invent a host to go green.
