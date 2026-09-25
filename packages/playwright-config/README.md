# @multilane/playwright-config

Shared Playwright preset for multilanetesting web/DOM lanes.

```ts
// playwright.config.ts
import { definePlaywrightConfig } from '@multilane/playwright-config';

export default definePlaywrightConfig({ testDir: './tests/web' });
```

Defaults: `baseURL` from `MULTILANE_WEB_BASE_URL` (no host literal), JUnit + HTML reporters under
`results/web/`, `trace: 'on-first-retry'`, retries only under `CI` (one retry, the ordinary
interleaved kind). Pass any `PlaywrightTestConfig` fields as overrides; `use` is merged shallowly.

Isolated retries (`retryStrategy: 'isolated'`, reruns alone at the end rather than interleaved with
unrelated parallel tests) need Playwright 1.62, which has **no stable release yet** — latest stable
is 1.61.1 and 1.62.0 exists only as `next`-tagged alphas. 1.61.1 accepts the key and silently
ignores it, so this preset does not set it; see the note in `index.mjs`.

Peer dependency: `@playwright/test@^1.40.0` (installed by the consumer's web lane).
