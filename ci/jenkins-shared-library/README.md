# multilane-jenkins — Jenkins Shared Library

Reusable pipeline for running multilanetesting lanes from Jenkins **without Docker**. Per-system jobs
stay a few lines; all logic lives in [`vars/runLaneTests.groovy`](vars/runLaneTests.groovy).

## Layout

```
ci/jenkins-shared-library/
  vars/
    runLaneTests.groovy    # the reusable step
  README.md
```

Extract this folder into its **own repository** (e.g. `multilane-jenkins`) and register it in Jenkins:
**Manage Jenkins → System → Global Pipeline Libraries** → add `multilane-jenkins` pointing at that
repo (default version `main`, "Load implicitly" off).

## Per-system usage

A consumer `Jenkinsfile` (see [`../Jenkinsfile.template`](../Jenkinsfile.template)):

```groovy
@Library('multilane-jenkins') _
runLaneTests(lanes: 'web,http', targetUrl: params.TARGET_URL, nodeVersion: '22.11.0')
```

### Parameters

| Key | Meaning | Default |
|---|---|---|
| `lanes` | comma-separated lanes to run (`web,http,stomp,screen`) | *(none)* |
| `targetUrl` | base URL / host of the system under test | `''` |
| `nodeVersion` | pinned Node major to provision | `22.11.0` |
| `agentLabel` | Jenkins agent label (empty = any agent) | `''` |

## What the pipeline does

1. **Checkout** the consumer repo.
2. **Ensure Node** — prefers the Jenkins **NodeJS tool** `node-<version>`; falls back to Node already
   on `PATH` (static agents) or **nvm** (documented). Fails clearly if none are available.
3. **Write `.npmrc`** from environment variables (scope `@multilane` → your npm registry). No secret is committed.
4. **`npm ci`** — reproducible install through the configured proxy.
5. **Playwright browsers** (web lane only) — installs Chromium routed through the proxy. **Not**
   `--with-deps` (needs root — see caveat).
6. **Verify** — `mlt verify` runs the deterministic gates (`no-runtime-ai`, `robot-contract`).
7. **Run requested lanes** — only the lanes you asked for, against `targetUrl`.
8. **Publish** — JUnit XML and Playwright traces are archived as build artifacts.

## Agent assumptions (both supported)

- **Static agents** — Node and browsers pre-installed. The step detects and reuses them.
- **Ephemeral agents** — provisioned fresh. Node comes from the NodeJS tool/nvm; browsers install on
  demand.

The step **detects and degrades** rather than hardcoding either; pass `agentLabel` to pin, or leave
it empty to run anywhere.

## Required environment (Jenkins credentials / global env — never committed)

| Variable | Purpose | Example |
|---|---|---|
| `NPM_REGISTRY_URL` | scoped registry URL for `@multilane` | `https://registry.example/repository/npm/` |
| `NPM_REGISTRY_AUTH_HOST` | `//host/path/` auth-key prefix for that registry | `//registry.example/repository/npm/` |
| `NPM_REGISTRY_AUTH_TOKEN` | registry authentication token | configured as a Jenkins credential |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | optional proxy settings | `NO_PROXY` should include the registry host |

## Caveat — Chromium system libraries (documented, not solved)

On locked-down Linux agents without root, Chromium can be missing shared system libraries and
`--with-deps` cannot be used. When that happens the web lane is marked **UNSTABLE** with a
`TODO(containerize-later)` marker in the log. That lane is the trigger to **containerize the web lane
in a future pass** — this pass intentionally adds **no Docker**.
