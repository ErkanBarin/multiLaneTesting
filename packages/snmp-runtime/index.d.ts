// Type definitions for @multilane/snmp-runtime.
import type { EmulatedAgentModel, SnmpBaseType } from '@multilane/snmp-model';

/** A value handed to the control plane: a number, a string, or an enumeration label. */
export type ControlValue = number | string;

export interface AgentSeed {
  /** Scalar values by model identifier name. Anything unseeded keeps the model's initial value. */
  scalars?: Record<string, ControlValue>;
  /** Rows by table name, each keyed by column name (index columns included). */
  tables?: Record<string, Array<Record<string, ControlValue>>>;
}

export interface TrapTarget {
  host?: string;
  port: number;
  community: string;
}

export interface AgentRuntimeOptions {
  model: EmulatedAgentModel;
  port: number;
  /** Per-run community — treat as a live credential, never commit it. */
  community: string;
  /** Loopback only by default; the emulator must never listen on a routable interface. */
  address?: string;
  seed?: AgentSeed;
  /** Serve the model's read-write objects as writable. Off by default. */
  writable?: boolean;
  /**
   * Serve an object with a type its model entry does not declare — a deliberately non-conformant
   * agent, used to prove a mismatch is exposed rather than silently decoded.
   */
  typeOverrides?: Record<string, { type: SnmpBaseType; value: ControlValue }>;
  /** Where `emit` sends notifications. */
  trapTarget?: TrapTarget;
}

/** A table the runtime could not register, and why. Never silently dropped. */
export interface UnservedTable {
  table: string;
  reason: string;
}

export interface EmitOptions {
  /** Index values of the row a row-scoped notification is about, in the table's index order. */
  index?: ControlValue[];
  /** Varbind values to send instead of what the agent currently holds. */
  values?: Record<string, ControlValue>;
  target?: TrapTarget;
}

export interface EmulatedAgent {
  readonly port: number;
  readonly model: EmulatedAgentModel;
  readonly unserved: readonly UnservedTable[];
  set(name: string, value: ControlValue): void;
  addRow(table: string, values: Record<string, ControlValue>): void;
  removeRow(table: string, index: ControlValue[]): void;
  emit(notification: string, options?: EmitOptions): Promise<void>;
  /** Stop answering without closing the port, so a caller sees a timeout, not a refusal. */
  goSilent(): void;
  resume(): void;
  close(): void;
}

/** The ASN.1 tag for every `SnmpBaseType` the model declares. */
export const OBJECT_TYPE: Readonly<Record<SnmpBaseType, number>>;

export function startEmulatedAgent(options: AgentRuntimeOptions): EmulatedAgent;

export interface TrapVarbind {
  oid: string;
  value: unknown;
}

export interface TrapNotification {
  varbinds: TrapVarbind[];
  source: { address: string; port: number };
}

export interface TrapListenerOptions {
  /** UDP port to listen on. Live trap traffic uses 162, which is privileged. */
  port: number;
  /** Bind address. Default loopback — widen deliberately, never implicitly. */
  address?: string;
}

export interface TrapListener {
  readonly port: number;
  readonly address: string;
  /** Every notification received since start, oldest first. */
  readonly received: TrapNotification[];
  /** Resolve on the first notification matching `predicate`; reject on timeout or on `close()`. */
  waitForTrap(predicate: (n: TrapNotification) => boolean, timeoutMs: number): Promise<TrapNotification>;
  close(): void;
}

/** Receive-only. Never sends, never injects — the receiving half of `EmulatedAgent.emit`. */
export function startTrapListener(options: TrapListenerOptions): TrapListener;
