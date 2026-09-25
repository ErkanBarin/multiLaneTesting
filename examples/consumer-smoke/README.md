# consumer-smoke — packaged-engine fixture

A consumer fixture that declares all 16 `@multilane/*` workspaces as versioned dependencies and
checks packaged exports. Nothing here imports engine source.

The repository's dogfood harness rewrites those dependencies to local `npm pack` tarballs and
installs the fixture offline. It separately checks authoring prerequisites and a generated
consumer project; the smoke suite does not require a live target.

```bash
npm run dogfood
```
