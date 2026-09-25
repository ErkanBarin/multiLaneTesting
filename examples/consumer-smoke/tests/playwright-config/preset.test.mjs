import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definePlaywrightConfig } from '@erkanbarin/playwright-config';

// Smoke: the PACKAGED @erkanbarin/playwright-config merges the shared preset with overrides.
// The preset is a pure object — no @playwright/test needed to build it.
test('packaged @erkanbarin/playwright-config merges preset and overrides', () => {
  const config = definePlaywrightConfig({ testDir: './specs', use: { trace: 'off' } });
  assert.equal(config.testDir, './specs');
  assert.equal(config.use.trace, 'off');
  assert.equal(config.use.screenshot, 'only-on-failure');
  assert.ok(config.reporter.some(([name]) => name === 'junit'));
});
