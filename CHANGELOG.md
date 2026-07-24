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
- `.github/workflows/regenerate-lockfile.yml`: manually triggered workflow that regenerates
  `package-lock.json` on an unrestricted GitHub runner with the pinned npm 10.9.0. It guards that
  every external entry gains `resolved` + `integrity` and that nothing but the lockfile changed
  (direct dependencies stay pinned by the untouched `package.json`; transitive drift is printed
  as a report for the bot-commit reviewer), verifies `npm ci` + full validate under npm 10 and
  `npm ci` under npm 11 / Node 24, and only then commits the repaired lockfile as the CI bot.
- `scripts/install-tarballs.mjs`: supported installer for the unpublished engine — packs every
  workspace into a consumer's `vendor/multilane/`, rewrites its `@multilane/*` dependencies to
  those tarballs with `overrides`, and runs the first `npm install` (creating the consumer's
  `package-lock.json`). The README consumer flow and the dogfood scaffolded-consumer probe run
  this same script.

### Changed

- `docs/onboarding.md` rewritten as a team-adoption guide: the engine-vs-consumer model, lane
  selection, the scaffold + tarball-install flow, environment configuration, CI wiring, optional
  AI-assisted authoring, and how to adapt the framework — replacing the pre-engine "agent builds
  the framework" bootstrap flow, which is now linked as the engine-extension path. The README
  gains a "Who this is for — and how to adopt it" section pointing at it.
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
- Scaffolding next steps: `mlt new`/`mlt create-system` completion output and
  the generated consumer README lead with the tarball installer
  (`node <engine-repo>/scripts/install-tarballs.mjs`) while the packages are
  unpublished — a plain `npm install` fails before the tarball rewrite and is
  now documented only as the post-publication path. The first install creates
  the consumer's `package-lock.json`, which users are told to commit. Unit and
  dogfood tests assert the generated instructions.
- Consumer quickstart documented as a runnable flow: project names are
  lowercase `[a-z0-9-]` and the scaffold lands under the current directory, so
  the README now runs `mlt new` from the clone's parent directory, followed by
  `scripts/install-tarballs.mjs` as the literal tarball-install step.
- Remaining "published engine packages" / "your npm registry" wording in the
  CLI package (README, source comments, generated consumer README and `.npmrc`)
  now states the actual model: `npm pack` tarballs today, registry installation
  only after publication.
- Package READMEs and `docs/API.md` now state that the `@multilane/*` packages
  are unpublished and must be consumed via `npm pack` tarballs until a
  publishing decision is made.
- `engines.npm` declared as `^10 || ^11` alongside `packageManager` — `npm ci`
  from the committed lockfile is verified under both npm majors by the
  regenerate-lockfile workflow.
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

### Removed

- `IMPLEMENTATION_PLAN.md` (the historical phased build-out plan — the engine is built;
  `ARCHITECTURE.md` and `BOOTSTRAP_PROMPT.md` remain the design and extension docs) and
  `docs/memory/tool-licence-audit.md` (audit history for a tool dropped in June; the licensing
  outcome is recorded in `ARCHITECTURE.md` and the blocker index).

### Fixed

- `scripts/install-tarballs.mjs` refuses — before mutating the project — consumer
  paths containing `#`, `%`, `\`, or `:`, which npm mishandles in `file:` specs
  (`#` truncates as a URL fragment, `%` fails URI decoding, `\` is rewritten to
  `/`, `:` breaks the `node_modules/.bin` PATH entry), with a clear error naming
  the offending character. It also refuses to run on native Windows, where the
  npm `.cmd` launcher cannot be invoked without a shell (use WSL). The dogfood
  harness asserts the refusal happens before any mutation.
- `scripts/install-tarballs.mjs` executes npm via argument-vector `execFileSync`
  instead of an interpolated shell command string, so consumer paths containing
  spaces, quotes, or shell metacharacters are passed as data instead of being
  interpreted as shell syntax (a command-injection surface). The dogfood
  scaffolded-consumer probe now runs the installer under such a path.
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
  pattern definitions exempted), covering 24 runtime files.

- `package-lock.json` regenerated on an unrestricted runner via the
  regenerate-lockfile workflow: every external entry now carries `resolved` +
  `integrity`, and `npm ci` is proven under npm 10 (with full validate) and
  npm 11 / Node 24 — the proxy-built lockfile previously failed `npm ci` under
  npm 11.
- The dogfood harness passes the consumer smoke-test glob unquoted
  (`node --test tests/*/*.test.mjs`) so the shell expands it: Node 20 — the
  supported minimum, used by CI — does not glob `--test` arguments, which made
  the dogfood step fail in CI while newer local Node versions masked it.
- No-runtime-AI wording no longer claims reachability: the gate's messages now
  read "no configured forbidden source patterns detected in N scanned runtime
  file(s)" / "forbidden source pattern(s) matched", and SECURITY.md, the README,
  `docs/test-strategy.md`, and the Jenkins docs drop "reachable" / "any usage" /
  "enforcement" claims, stating instead that the gate is a finite source-pattern
  heuristic backed by code review — dynamically constructed imports/URLs are
  outside its scope.

### Security

- `check:no-runtime-ai` policy gate pattern-scans runtime package sources for
  AI/model network-call usage (a source-pattern check, not a call-graph proof;
  dynamically constructed imports/URLs are outside its scope and rely on code
  review); AI tooling is confined to authoring time. The gate fails if it scans
  zero files.
