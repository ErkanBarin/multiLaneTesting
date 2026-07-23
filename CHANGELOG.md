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
  identifiers remain in committed files.

### Security

- `check:no-runtime-ai` policy gate enforces that no AI or model network calls
  are present in runtime packages; AI tooling is confined to authoring time.
