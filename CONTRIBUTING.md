# Contributing

Thank you for your interest in contributing to multilanetesting.

## Status

This project is experimental and pre-1.0. The public API, package structure,
and governance are not yet stable. Significant contributions may be held until
the license and DCO/CLA terms are settled — see the note at the end of this
file.

## Setup

```sh
git clone https://github.com/ErkanBarin/multiLaneTesting.git
cd multiLaneTesting
npm ci
npm run validate   # typecheck + lint + unit tests + policy gates
```

Node >= 20 is required. The project has been validated on Linux only.

## Checks

| Command | What it does |
|---|---|
| `npm run validate` | Full gate: typecheck, lint, unit tests, policy checks |
| `npm run check:no-runtime-ai` | Confirms no AI/model calls in runtime packages |
| `npm run dogfood` | Packaged-consumer integration check |

Run `npm run validate` before every push. All gates must be green for a PR to
be considered.

## Coding rules

- **Smallest safe change.** Add no abstractions, wrappers, or configuration
  that the current code does not require.
- **No AI dependencies in runtime packages.** AI tooling is permitted at
  authoring time only. The `check:no-runtime-ai` gate enforces this; do not
  work around it.
- **No host literals or credentials in committed files.** Reference
  environment-variable names in code and documentation. Do not commit `.env`
  files, tokens, internal hostnames, or internal project identifiers.
- **Deterministic tests only.** No `sleep` or arbitrary time delays. No
  `.only` modifiers left in committed test files. Tests must produce the same
  result on every run given the same inputs.

## Secret scanning

Before pushing, run a local secret scan to catch accidental credential
commits. Tools such as `gitleaks` or `trufflehog` can scan your working tree:

```sh
gitleaks detect --source .
# or
trufflehog git file://. --since-commit HEAD
```

Internal hostnames, tokens, and `.env` content must never appear in committed
files.

## Pull request expectations

- All gates from `npm run validate` are green.
- `npm run dogfood` passes.
- No new runtime AI dependencies are introduced.
- No internal hostnames or credentials are present.
- Documentation is updated to match any behavior change.
- Tests cover any new or changed behavior.
- If `package-lock.json` changed, the change is intentional and explained in
  the PR description.

## License and DCO/CLA

The packages in this repository are currently marked `UNLICENSED`. A license
has not yet been chosen; that is a pending human decision. Until the license
and any contributor agreement are finalized, significant contributions may be
held for review and may require retroactive agreement to the terms that are
ultimately adopted. By opening a PR you acknowledge this situation.

[PLACEHOLDER — DCO/CLA terms to be confirmed by the maintainer]
