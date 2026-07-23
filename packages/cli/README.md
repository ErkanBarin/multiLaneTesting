# @multilane/cli

The `mlt` command line for **multilanetesting**.

## Install

The `@multilane/*` packages are **not published to any registry yet** — install them from
`npm pack` tarballs with `overrides` (see the repo README → Dogfooding) until a publishing
decision is made. Once published, this becomes:

```bash
npm install --save-dev @multilane/cli
```

Provides the `mlt` binary (also runnable with `npx mlt`).

## Commands

### `mlt verify`

Run every deterministic gate (`no-runtime-ai`, `robot-contract`) against the current project and
print a green/red table. Exit code is non-zero if any gate fails. This is the same implementation as
the engine's own `npm run check:*` scripts.

### `mlt new <name> --lanes <list>`

Scaffold a consumer test project that **depends on** the published engine packages (it never vendors
framework source). Lanes: `web`, `http`, `stomp`, `screen`.

```bash
mlt new demo --lanes web,http
cd demo
npm install      # first install creates package-lock.json — commit it so CI can run npm ci
npm run verify
```

The generated project includes a config skeleton, a frozen-locator directory, one example spec per
selected lane, a proxy/registry-aware `.npmrc`, and a thin `Jenkinsfile` that calls the shared library.
No host, URL, or secret literal is written to any generated file.

### `mlt create-system <name> --lanes <list>`

`mlt new` plus authoring setup: scaffolds the project **and** runs `mlt authoring install` for the
selected lanes. Exits nonzero if an authoring package (`@multilane/authoring-<lane>`) is not
resolvable; the scaffold on disk is left intact so you can install the package and rerun
`mlt authoring install`.
