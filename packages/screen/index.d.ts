// Type definitions for @multilane/screen.

export interface FrozenLocator {
  area: string;
  key: string;
  tier: 1 | 2;
  resolver: string;
  requirement_ref: string;
  stamp?: { dpi?: number; resolution?: string; theme?: string };
  last_verified?: string;
  [extra: string]: unknown;
}

export function loadFrozenLocator(
  area: string,
  key: string,
  options?: { cwd?: string; locatorsDir?: string; env?: Record<string, string | undefined> },
): FrozenLocator;

export function assertFrozen(locator: unknown): { ok: boolean; errors: string[] };
