// @erkanbarin/playwright-config — a shared Playwright preset consumers extend.
//
// Deterministic defaults: no sleeps, env-driven baseURL (never a host literal), JUnit + HTML
// evidence, trace on first retry. Consumers call `definePlaywrightConfig({ testDir, use, ... })`.

/**
 * Build a Playwright config from the shared preset merged with per-project overrides.
 * @param {object} [overrides]
 * @returns {object} a PlaywrightTestConfig
 */
export function definePlaywrightConfig(overrides = {}) {
  const { use: useOverrides, ...rest } = overrides;
  const baseURL = process.env.MULTILANE_WEB_BASE_URL || undefined;
  const ci = !!process.env.CI;

  return {
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 1 : 0,
    // ponytail: no `retryStrategy: 'isolated'` yet — it needs Playwright 1.62, which has no stable
    // release (latest stable is 1.61.1; 1.62.0 exists only as `next` alphas). 1.61.1 silently
    // ignores the unknown key, so setting it bought nothing but a docs claim that wasn't true.
    // Add it back when 1.62 ships stable and the peer range below moves with it.
    reporter: [
      ['junit', { outputFile: 'results/web/junit.xml' }],
      ['html', { outputFolder: 'results/web/html', open: 'never' }],
      ['list'],
    ],
    use: {
      baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      ...(useOverrides ?? {}),
    },
    ...rest,
  };
}
