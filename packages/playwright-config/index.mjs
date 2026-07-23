// @multilane/playwright-config — a shared Playwright preset consumers extend.
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
