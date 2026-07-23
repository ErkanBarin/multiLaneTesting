// Type definitions for @multilane/http.

export interface JsonResponse {
  status: number | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export function assertApprovedHost(url: string, approvedHosts?: string[]): void;

export function getJson(
  url: string,
  options?: {
    headers?: Record<string, string>;
    approvedHosts?: string[];
    /** Reject if no response completes within this time. Default 30000. */
    timeoutMs?: number;
    /** Reject once the response body exceeds this many bytes. Default 10000000. */
    maxBodyBytes?: number;
  },
): Promise<JsonResponse>;

export function assertShape(
  obj: Record<string, unknown>,
  shape: Record<string, string>,
): { ok: boolean; errors: string[] };
