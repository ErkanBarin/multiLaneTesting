# @erkanbarin/cli

The `mlt` command line for **multilanetesting**.

## Install

```bash
npm install --save-dev @erkanbarin/cli
```

Provides the `mlt` binary (also runnable with `npx mlt`).

## Commands

### `mlt verify`

Run the three static gates (`no-runtime-ai`, `robot-contract`, `screen-partition`) against the
current project and print a green/red table. Exit code is non-zero if any gate fails; lane tests
run separately with `npm run test:<lane>`.

### `mlt new <name> --lanes <list>`

Scaffold a consumer test project that **depends on** the published engine packages (it never vendors
framework source). Lanes: `web`, `http`, `stomp`, `screen`, `snmp`, `trap`.

```bash
mlt new demo --lanes web,http
cd demo
npm install
npm run verify
```

The generated project includes a config skeleton, a frozen-locator directory, one example spec per
selected lane, a commented `.npmrc` that leaves registry mapping in user config, and a thin
`Jenkinsfile` that calls a separately configured shared library.
No host, URL, or secret literal is written to any generated file.
