# Robot orchestration — `multilanetesting`

Optional **tier-1 wrapper** that runs the framework's lanes through Robot Framework and produces one
unified report. Adapted from a sibling Robot orchestration repo pattern. The framework itself does not depend on
Robot — this is an orchestration layer on top.

## Two-repo shape

| Repo | Tier | Holds |
|---|---|---|
| `multilanetesting` (this repo) | tier-2 | Authoritative specs, drivers, npm/driver scripts, tag guard, traceability |
| `multilanetesting-robot` (sibling) | tier-1 | Robot suites + one resource file that calls this repo's scripts |

Connected by a sibling path variable, e.g. `MULTILANE_ROOT = ${CURDIR}/../../multilanetesting`. Robot calls
scripts via the **Process** library, captures stdout/exit codes, and merges results — it does not parse
the framework internals.

## Granularity

| Level | Example |
|---|---|
| Lane | `./bin/run.sh suites/lanes.robot` |
| Area | `./bin/run.sh suites/areas.robot --test "Sample Panel"` |
| Tag | `./bin/run.sh suites/tags.robot --variable SCREEN_TAG:@samplePanelCrud` |

## Flow

```
trigger -> run.sh -> robot -> screen_process.resource -> npm/driver script
        -> deterministic driver -> screen target (test partition) -> exit code + logs -> report
```

Robot passes the tag as an **opaque string** and only propagates exit codes + captured logs.

## Two tag systems (keep in sync)

- **Robot tags** — `[Tags]` in `tags.robot`, selected with `robot --include`.
- **Framework tags** — `@name` in spec titles, selected with the runner's `--grep`/filter.

Consistency is required in **four** places: (1) the spec title, (2) the guard's `TAGS[]` list, (3) the
contract doc, (4) the Robot test case. A guard `npm run check:robot-contract` enforces (1)–(3).

## Reporting

- Robot emits `results/output.xml`, `log.html`, `report.html`.
- Per-lane stdout is archived under `artifacts/robot/`.
- `rebot --merge` combines multiple `output.xml` runs into one report.

## Guardrails

- Guarded lanes (active WS SEND) require their two-flag opt-in + approved host **inside** the called
  script — Robot does not bypass them.
- No host literals in committed suites — env-var names only.
