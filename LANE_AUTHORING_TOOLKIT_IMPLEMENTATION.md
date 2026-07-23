# Lane-Aware Authoring Toolkit

Status: authoring packages are implemented for the **web**, **http**, and **stomp** lanes.
The **screen** authoring package remains planned. Authoring assets are optional and never enter a
runtime test path.

## Architecture decisions

Each lane has separate runtime and authoring packages:

```text
@multilane/<lane>            Runtime capability
@multilane/authoring-<lane>  Skills, agents, and deterministic manifest metadata
```

The separation is deliberate:

1. Consumers opt in to authoring content without adding it to runtime package tarballs.
2. One package is the natural unit for npm resolution, versioning, integrity, and installation.
3. Runtime isolation is easy to inspect: runtime packages do not depend on or import authoring
   packages.
4. Authoring instructions can version independently from runtime code.

The CLI resolves an authoring package, reads its manifest, and materializes declared targets into
consumer `.claude/` and `.github/` paths. It writes deterministic provenance to
`.multilane/authoring.lock.json`; runtime packages do not read those paths.

## Package contract

Each authoring package contains:

```text
package.json
index.mjs
index.d.ts
lane.manifest.json
assets/skills/<id>/SKILL.md
assets/agents/<id>/AGENT.md
README.md
```

Package exports include `.`, `./lane.manifest.json`, and `./package.json`. The package.json export
is required because `resolveAuthoringPackage()` reads the installed package version for provenance
and drift detection; Node blocks undeclared subpaths once an exports map exists.

Lane manifests declare:

- lane, runtime package, authoring package, and independent compatibility range;
- tool and environment prerequisites;
- each asset's portability classification and optional configuration ID;
- the source file and deterministic Claude/Copilot materialization targets.

Compatibility metadata is a published contract even though range enforcement is not implemented
yet. Do not remove it based only on internal call-site searches.

## Materialization model

Claude assets are the source of truth and are copied verbatim. Copilot prompt and agent targets are
generated as thin wrappers that link to the materialized Claude file, matching the repository's
own `.claude/` to `.github/` convention. Cross-links are normalized to forward slashes.

`portable` records whether an asset works in a consumer immediately or requires path, MCP, or
environment configuration. Portable assets must not reference engine-relative paths such as
`docs/memory/*` because those paths need not exist in a consumer repository.

An optional asset may declare `requires.mcpServers` and/or `requires.env`. The installer checks all
declared prerequisites before writing any target:

- all prerequisites pass: materialize the asset as enabled;
- any prerequisite fails: write no target for that asset and report why;
- when `configureId` is present, report the matching `mlt authoring configure <id>` command.

This prevents half-installed optional agents. `mlt authoring configure` derives stable setup steps
from the installed lane manifests rather than inventing target-specific instructions.

## Versioning and drift

Authoring packages are exact-pinned, independently versioned, and explicitly compatibility-ranged.
They are not required to move in lockstep with runtime packages.

- A typo or formatting correction is a patch.
- A change to agent or skill behavior is at least a minor version change.
- Consumers receive no instruction change until they review a package-version update and run
  `mlt authoring update` explicitly.
- No install, postinstall, or CI hook updates materialized assets automatically.

`mlt authoring check` detects:

- installed package-version drift;
- source-content drift, even without a version bump;
- modified, deleted, or unexpected files in managed target directories;
- malformed or missing provenance;
- lane-selection drift.

Directory-wide extra-file detection is intentional. It can identify stale installer-owned files
from older manifests; limiting the scan to current provenance targets would miss those files.

## CLI contract

```text
mlt authoring install --lanes <list> [--tools claude,copilot] [--force]
mlt authoring check
mlt authoring update [--lanes <list>] [--tools <list>]
mlt authoring configure <configureId>
mlt create-system <name> --lanes <list>
```

- `install` requires a validated, deduplicated lane list.
- A known lane without an authoring package is reported as unavailable without blocking other
  lanes.
- `--force` permits overwriting an untracked target; without it, unrelated files are protected.
- `create-system` composes scaffolding and authoring installation into the newly-created project.
- `updateAuthoring()` is a published CLI API as well as the implementation behind the update
  command; preserve it unless a deliberate public API change is approved.

## Portability boundaries

The packaged web, HTTP, and STOMP skills are portable now. Their optional explorer agents require
the prerequisites declared by their manifests:

| Asset | Portability requirement |
|---|---|
| `ui-explorer` | configured Playwright MCP server |
| `api-explorer` | HTTP target and approved-host environment variables |
| `stomp-explorer` | WebSocket URL environment variable |

The repository's screen agents and skills are not automatically portable. Several assume this
engine's `docs/memory/`, `locators/`, MCP wiring, or repository-hygiene commands. Parameterize and
package them only as part of the planned screen authoring lane; do not copy them into consumers as
if those assumptions already hold.

## Validation

Run the current executable checks instead of preserving historical output in this document:

```bash
npm run validate
npm run dogfood
npm pack --dry-run -w @multilane/authoring-web
npm pack --dry-run -w @multilane/authoring-http
npm pack --dry-run -w @multilane/authoring-stomp
npm pack --dry-run -w @multilane/cli
```

The package dry runs are the tarball-content proof. Fixture tests prove consumer-side Node
resolution and deterministic materialization, but they do not prove a live publication to your npm
registry or install through a real agent proxy; validate that path in your deployment environment.

## 10. Open decisions

- Build and package the screen authoring lane only after its consumer path and prerequisites are
  specified.
- Enforce manifest compatibility ranges when more than one real runtime/authoring version makes a
  violation possible.
- Consider a portable repository-hygiene asset only when multiple consumer lanes demonstrate a
  shared need; current `repo-keeper` and `pr-hygiene` customizations remain engine-specific.
- Keep package boundaries, public exports, compatibility metadata, and generated target formats
  stable unless external consumer and release contracts are reviewed explicitly.
