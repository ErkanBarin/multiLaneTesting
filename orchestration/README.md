# Orchestration — `multilanetesting-robot` (sibling repo, optional)

This folder documents the **intended** sibling orchestration repo. It is not the repo itself — the
Robot wrapper lives in its own checkout (`multilanetesting-robot`) so the core framework stays dependency-free
of Robot/Java. Full contract: [`../docs/ci/robot-orchestration.md`](../docs/ci/robot-orchestration.md).

## Intended layout of `multilanetesting-robot`

```
multilanetesting-robot/
  bin/run.sh                 # entrypoint: forwards to robot with the right suite/variable
  suites/
    lanes.robot              # one test per lane
    areas.robot              # one test per functional area
    tags.robot               # one test per supported @tag
  resources/
    screen_process.resource  # the ONE resource file that calls multilanetesting scripts via Process
  results/                   # output.xml, log.html, report.html (gitignored)
```

## Wiring

- `MULTILANE_ROOT = ${CURDIR}/../../multilanetesting` — sibling path to this repo.
- `screen_process.resource` shells out to this repo's npm/driver scripts and captures exit code + logs.
- Robot never imports framework internals; it orchestrates and reports only.

## Supported tags (seed list — keep in sync with the guard + specs)

`@milAreasCrud`, `@docNavigate`, `@regulationShape` … (replace with real tags as specs land).
Guarded (require the two-flag opt-in + approved host inside the called script): `@injectBroadcast` …

## Why a separate repo

- Keeps the core framework runnable with **no Robot/Java dependency**.
- Lets CI check out both siblings and run the wrapper without coupling release cadences.
- Matches the web application `a DOM-focused test suite` / `a DOM-focused test suite-robot` split exactly.
