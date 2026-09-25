# @erkanbarin/web

Web/DOM lane helpers for multilanetesting, built on Playwright.

```ts
import { test, expect } from '@playwright/test';
import { selectorFactory } from '@erkanbarin/web';

test('user sees the shell', async ({ page }) => {
  const ui = selectorFactory(page, { appRoot: 'body', title: 'h1' });
  await page.goto('/');
  await expect(ui.appRoot()).toBeVisible();
});
```

Peer dependency: `@playwright/test`. This package pulls in **no** browser or vision dependency — an
`@erkanbarin/http`-only consumer never installs it.
