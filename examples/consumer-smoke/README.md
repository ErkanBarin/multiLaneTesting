# consumer-smoke — dogfood fixture

A minimal consumer that proves the **packaged** engine works. It declares all ten `@multilane/*`
packages as normal registry-style dependencies (versions, not source paths) and runs a smoke suite
covering the `http`, `screen`, `stomp` (send guards), `web` (selector factory), and
`playwright-config` lanes plus the three authoring-package manifests.

It is exercised by the repo-root harness, which installs the engine from **`npm pack` tarballs**
(never source imports):

```bash
npm run dogfood
```

The harness (`scripts/dogfood.mjs`):

1. `npm pack`s every `@multilane/*` workspace into a temp dir.
2. Copies this folder to a temp workspace, rewrites the `@multilane/*` versions to the local
   tarballs, and adds matching `overrides` so nested workspace deps resolve to the tarballs too.
3. `npm install --offline` — proving the tarballs install hermetically with no registry access.
4. Runs `mlt verify` (the deterministic gates) and the smoke suite.

Nothing here imports framework source — it consumes the built packages exactly as a real project on
a registry would.
