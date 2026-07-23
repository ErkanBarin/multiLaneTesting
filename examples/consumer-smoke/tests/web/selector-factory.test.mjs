import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectorFactory } from '@multilane/web';

// Smoke: the PACKAGED @multilane/web builds named locator getters from a selector map.
// A stub page stands in for Playwright — no browser, no peer dependency needed.
test('packaged @multilane/web builds a selector factory', () => {
  const page = { locator: (selector) => ({ selector }) };
  const panel = selectorFactory(page, {
    title: '[data-testid="app-title"]',
    submit: '[data-testid="submit"]',
  });
  assert.deepEqual(panel.title(), { selector: '[data-testid="app-title"]' });
  assert.deepEqual(panel.submit(), { selector: '[data-testid="submit"]' });
});
