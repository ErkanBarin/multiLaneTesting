# Security Policy

## Supported Versions

| Version | Status |
|---|---|
| 0.1.x | Experimental — best-effort, no SLA |

This project is pre-1.0 and experimental. Security fixes will be applied on a
best-effort basis. There is no guarantee of patch timelines.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately via GitHub's private vulnerability reporting:
open the repository's **Security** tab and choose **Report a vulnerability**.
This feature is enabled for this repository and is the only reporting channel;
there is no separate security contact address.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (no live target required)
- Affected package(s) and version(s)

You can expect an acknowledgment within a reasonable timeframe. Given the
experimental status of this project, response times are best-effort.

## Threat Model and Runtime Trust Boundary

### Determinism and model-offline runtime

Test runtime is designed to be deterministic and **model-offline**: the runtime
packages declare no AI/model dependencies, and the `npm run check:no-runtime-ai`
policy gate pattern-scans runtime package sources, failing when a configured
forbidden source pattern is detected — or when it scans zero files. This is a
finite source-pattern heuristic backed by code review, not a call-graph or
dependency-reachability proof: dynamically constructed imports or URLs are not
detectable by a pattern list. Target-system network access is lane-dependent
(the HTTP/STOMP/web lanes talk to the system under test). AI tooling (MCP
servers, agent configuration files) is confined to authoring time and must
never receive credentials, secrets, or the content of `.env` files.

### Trust boundary

| Input | Trust level |
|---|---|
| Test code and frozen locator files | Trusted — they execute with the developer's privileges; the loader still resolves real paths and refuses locators that escape `locators/` via symlink |
| Target-system responses | Untrusted — bounds are per-lane: HTTP responses are size-capped with an absolute request deadline; STOMP frames are governed by `@stomp/stompjs`/`ws` defaults; web responses are handled by Playwright |
| npm supply chain | Trusted via committed lockfile (`package-lock.json`) |
| CI secrets | Must be injected via CI credential stores; never committed |

### TLS

TLS verification is enabled by default. No TLS bypass is committed to this
repository. Any local exception (for example, a self-signed certificate in a
development environment) must be an explicit, local, uncommitted opt-in and
must not appear in committed configuration files.

### Evidence artifacts

JUnit XML, HTML reports, and traces produced by test runs can capture screen
content. Users must ensure that no credentials, tokens, or sensitive data are
typed into or displayed by the system under test during recorded or traced
scenarios.

### Telemetry

This framework collects no telemetry. No usage data is sent anywhere by the
framework at runtime or authoring time.
