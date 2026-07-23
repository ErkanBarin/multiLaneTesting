# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — work in progress as of 2026-07-23

### Added

- Initial public snapshot at version 0.1.0: npm workspace of ten `@multilane/*`
  packages (core, cli, http, stomp, web, screen, authoring-http, authoring-stomp,
  authoring-web, playwright-config) plus a stub Python screen driver.
- Community files: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md,
  GitHub issue templates, PR template, and Dependabot configuration.
- CI pipeline for automated validation on push and pull request.
- Committed `package-lock.json` for reproducible installs.

### Changed

- TLS bypass removed from MCP server configuration; TLS verification is now on
  by default with no committed exception.
- MCP tool versions pinned for reproducibility.
- HTTP and STOMP lane helpers: request timeouts and response size caps added.
- Internal terminology generalized; no internal host names or project-specific
  identifiers remain in committed files. Registry configuration migration: the
  registry environment variables consumed by the Jenkins shared library and the
  generated `.npmrc` were renamed to `NPM_REGISTRY_URL`, `NPM_REGISTRY_AUTH_HOST`,
  and `NPM_REGISTRY_AUTH_TOKEN`; operators of pre-rename CI jobs must update
  their job environment to the new names.
- `mlt new`/`mlt create-system` scaffolds now declare the selected lanes'
  `@multilane/authoring-*` packages as devDependencies, so `mlt authoring
  install` resolves them from the consumer's own `node_modules`.
- Scaffolding now prints `npm install` (which creates the consumer's
  `package-lock.json`) as the next step instead of `npm ci`, which cannot run
  before a lockfile exists; the generated README says the same and tells users
  to commit the lockfile.
- Consumer quickstart documented as a runnable flow: project names are
  lowercase `[a-z0-9-]` and the scaffold lands under the current directory, so
  the README now runs `mlt new` from the clone's parent directory.
- Package READMEs and `docs/API.md` now state that the `@multilane/*` packages
  are unpublished and must be consumed via `npm pack` tarballs until a
  publishing decision is made.
- `engines.npm` declared as `^10` alongside `packageManager` — the committed
  lockfile is npm-10-generated and npm 11 may reject it.
- The dogfood harness gained a scaffolded-consumer probe: `mlt create-system`
  with the `http` lane from packed tarballs, offline install of the generated
  project, assertion that a `package-lock.json` is created, and a passing
  `mlt verify` — the documented consumer flow, end to end.
- Copilot worker agents (`cheap-repository-worker`, `technical-worker`) no longer
  commit a `model` field; they inherit the invoking session's model. Pin a model
  locally if your environment supports it.
- `packageManager` declared as `npm@10.9.0` — the committed lockfile was produced
  by npm 10 on a restricted network.
- `dotenv-cli` removed (unused devDependency).

### Fixed

- `@multilane/http` `getJson` timeout is now an absolute deadline for the whole
  request+response instead of a socket-inactivity timer, so a slow-drip response
  can no longer hold a run open indefinitely. Invalid `timeoutMs`/`maxBodyBytes`
  options are rejected up front.
- `@multilane/stomp` helpers settle exactly once and reject promptly when the
  WebSocket closes before the STOMP session completes, instead of waiting for
  the full timeout.
- `@multilane/screen` locator loading resolves real paths and refuses any
  locator that escapes `locators/` via symlink.
- `mlt create-system` now exits nonzero when the post-scaffold authoring
  install fails (the scaffold on disk is left intact); previously it reported
  the failure but exited 0. The dogfood harness includes a minimal-consumer
  probe asserting this. Plain `mlt new` does not attempt authoring installation.
- The no-runtime-AI gate fails when it scans zero runtime files — a vacuous scan
  is no longer a pass. The engine repo now commits a `multilane.config.json`
  scanning `packages/` and `scripts/` (authoring packages and the gate's own
  pattern definitions exempted), covering 23 runtime files.

### Known limitations

- The committed `package-lock.json` was generated with npm 10 behind a
  restricted proxy. npm 11 (bundled with Node 24) may reject it during
  `npm ci`; regenerate the lockfile on an unrestricted network if that occurs.

### Security

- `check:no-runtime-ai` policy gate enforces that no AI or model network calls
  are present in runtime packages; AI tooling is confined to authoring time.
  The gate fails if it scans zero files.
