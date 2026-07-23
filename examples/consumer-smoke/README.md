# consumer-smoke — dogfood fixture

A minimal consumer that proves the **packaged** engine works. It declares `@multilane/*` as normal
Nexus-style dependencies (versions, not source paths) and runs a smoke suite for the `http` and
`screen` lanes.

It is exercised by the repo-root harness, which installs the engine from **`npm pack` tarballs**
(never source imports):

```bash
npm run dogfood
```

The harness (`scripts/dogfood.mjs`):

1. `npm pack`s `@multilane/{core,cli,http,screen}` into a temp dir.
2. Copies this folder to a temp workspace and rewrites the `@multilane/*` versions to the local
   tarballs.
3. `npm install` (offline) — proving the tarballs install cleanly with no external deps.
4. Runs `mlt verify` (the deterministic gates) and the smoke suite.

Nothing here imports framework source — it consumes the built packages exactly as a real project on
Nexus would.
