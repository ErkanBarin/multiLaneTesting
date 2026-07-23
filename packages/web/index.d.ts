// Type definitions for @multilane/web.
import type { Page, Locator } from '@playwright/test';

export function selectorFactory<M extends Record<string, string>>(
  page: Page,
  map: M,
): { [K in keyof M]: () => Locator };
