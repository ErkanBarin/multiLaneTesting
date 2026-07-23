# Security Policy

## Supported Versions

| Version | Status |
|---|---|
| 0.1.x | Experimental — best-effort, no SLA |

This project is pre-1.0 and experimental. Security fixes will be applied on a
best-effort basis. There is no guarantee of patch timelines.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately to:

**[SECURITY CONTACT — to be confirmed by the maintainer]**

If the maintainer has enabled GitHub's private vulnerability reporting feature
for this repository, you may also use that channel (check the repository's
Security tab). Whether that feature is enabled is not guaranteed at this time.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (no live target required)
- Affected package(s) and version(s)

You can expect an acknowledgment within a reasonable timeframe. Given the
experimental status of this project, response times are best-effort.

## Threat Model and Runtime Trust Boundary

### Determinism and offline runtime

Test runtime is deterministic and offline-capable. No AI or model network calls
occur at runtime; this is enforced by the `npm run check:no-runtime-ai` policy
gate. AI tooling (MCP servers, agent configuration files) is confined to
authoring time and must never receive credentials, secrets, or the content of
`.env` files.

### Trust boundary

| Input | Trust level |
|---|---|
| Test code and frozen locator files | Trusted — they execute with the developer's privileges |
| Target-system responses | Untrusted — bounded and validated by lane helpers |
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
