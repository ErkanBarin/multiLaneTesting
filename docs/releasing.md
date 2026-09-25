# Releasing to npm (maintainers)

The 16 `@erkanbarin/*` workspaces publish to the public npm registry from GitHub Actions only
([`release.yml`](../.github/workflows/release.yml)). The workflow validates, runs dogfood, and then
publishes every workspace whose `name@version` is not on npm yet — unchanged packages are skipped.
Each publish carries a provenance attestation linking it to the workflow run.

Publishing is effectively permanent: npm allows unpublish only within 72 hours and only when nothing
depends on the version. Always run the dry run first.

## One-time setup

1. **npm account.** The `@erkanbarin` scope belongs to the npm user `erkanbarin`; sign in and
   enable two-factor authentication.
2. **Bootstrap token** (trusted publishing can only be configured for packages that already
   exist). On npmjs.com → *Access Tokens* → *Generate New Token* → *Granular Access Token*:
   packages *Read and write*, all packages, **Bypass 2FA** enabled, shortest expiry that covers the
   first release. Save it as the repository secret `NPM_TOKEN`
   (*Settings → Secrets and variables → Actions*).
3. **First publish.** *Actions → Release → Run workflow* with *dry run* checked; read the log (16
   packages, each with `LICENSE`, `README.md`, and only its `files`). Then run it again unchecked.
4. **Switch to trusted publishing.** For each package on npmjs.com → *Settings* → *Trusted
   Publisher* → *GitHub Actions*: owner `ErkanBarin`, repository `multiLaneTesting`, workflow
   `release.yml`. Then delete the `NPM_TOKEN` secret and revoke the token. Optionally set
   *Publishing access* to "Require two-factor authentication and disallow tokens".

## Every release

1. Bump `version` in each changed `packages/<name>/package.json`, and in any package that depends
   on it. Keep `ENGINE_VERSIONS` in [`packages/cli/src/scaffold.mjs`](../packages/cli/src/scaffold.mjs)
   in step — `scaffold-versions.test.mjs` fails on drift — then run `npm install` to refresh the
   lockfile.
2. Add a [`CHANGELOG.md`](../CHANGELOG.md) entry, open a PR, and merge once CI is green.
3. *Actions → Release → Run workflow*: dry run first, then for real.
