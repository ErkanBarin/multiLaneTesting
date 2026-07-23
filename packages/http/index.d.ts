// Type definitions for @multilane/http.

export interface JsonResponse {
  status: number | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export function assertApprovedHost(url: string, approvedHosts?: string[]): void;

export function getJson(
  url: string,
  options?: { headers?: Record<string, string>; approvedHosts?: string[] },
): Promise<JsonResponse>;

export function assertShape(
  obj: Record<string, unknown>,
  shape: Record<string, string>,
): { ok: boolean; errors: string[] };
