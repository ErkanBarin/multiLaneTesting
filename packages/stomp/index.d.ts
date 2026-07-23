// Type definitions for @multilane/stomp.

export interface StompMessage {
  headers: Record<string, string>;
  body: string;
}

export function subscribeOnce(
  url: string,
  destination: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<StompMessage>;

export function send(
  url: string,
  destination: string,
  body: string,
  options?: { inject?: boolean; approvedHosts?: string[]; headers?: Record<string, string> },
): Promise<void>;
