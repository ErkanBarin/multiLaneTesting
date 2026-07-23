// @multilane/web — web/DOM lane helpers.
//
// The selector-factory pattern: a named map of stable selectors resolved to Playwright Locators.
// Keep selectors declarative and stable; never discover them at runtime.

/**
 * Build a factory of named Locator getters from a selector map.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} map  name -> selector string
 * @returns {Record<string, () => import('@playwright/test').Locator>}
 */
export function selectorFactory(page, map) {
  const factory = {};
  for (const [name, selector] of Object.entries(map)) {
    factory[name] = () => page.locator(selector);
  }
  return factory;
}
