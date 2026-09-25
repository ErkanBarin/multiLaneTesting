import type { EmulatedAgentModel } from '@erkanbarin/snmp-model';

export interface SelectionAdapterOptions {
  /** Selection list content. Supply this or `selectionPath`. */
  selectionText?: string;
  /** Explicit selection list path. Never inferred from the current working directory. */
  selectionPath?: string;
  /** Parsed SMI/MIB content. Supply this or `mibPath`. */
  mib?: string;
  /** Explicit SMI/MIB file path. Never inferred from the current working directory. */
  mibPath?: string;
  /** Overrides the `subsystem` directive in the selection list. */
  subsystem?: string;
}

export interface SelectionAdapterResult {
  model: EmulatedAgentModel;
  /** Alias for `model.gaps`, retained so callers can report unresolved declarations directly. */
  gaps: EmulatedAgentModel['gaps'];
  debug: { selectedIdentifiers: string[] };
}

export class SelectionAdapterError extends Error {}

/**
 * Generates a validated model from a selection list and SMI/MIB input.
 */
export function buildSelectionModel(options: SelectionAdapterOptions): SelectionAdapterResult;