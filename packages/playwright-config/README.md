# @multilane/playwright-config

Shared Playwright preset for multilanetesting web/DOM lanes.

```ts
// playwright.config.ts
import { definePlaywrightConfig } from '@multilane/playwright-config';

export default definePlaywrightConfig({ testDir: './tests/web' });
```

Defaults: `baseURL` from `MULTILANE_WEB_BASE_URL` (no host literal), JUnit + HTML reporters under
`results/web/`, `trace: 'on-first-retry'`, retries only under `CI`. Pass any `PlaywrightTestConfig`
fields as overrides; `use` is merged shallowly.

Peer dependency: `@playwright/test` (installed by the consumer's web lane).
