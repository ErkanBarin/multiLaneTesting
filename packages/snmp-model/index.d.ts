// Type definitions for @erkanbarin/snmp-model.

export type SnmpBaseType =
  | 'Integer'
  | 'OctetString'
  | 'ObjectIdentifier'
  | 'IpAddress'
  | 'Counter'
  | 'Gauge'
  | 'TimeTicks'
  | 'Counter64';

export interface EmulatedValue {
  type: SnmpBaseType;
  /** Integers are numbers; every other base type is carried as a string. */
  value: number | string;
  /** The enum label `value` corresponds to, when the object's syntax is an enumeration. */
  enumLabel?: string;
}

export interface EmulatedScalar {
  /** MIB identifier name, e.g. `myAgentStatus`. */
  name: string;
  /** Object OID *without* the `.0` instance suffix. */
  oid: string;
  readOnly: boolean;
  /** Every legal value for an enumerated object, so a consumer can drive it by label. */
  enumValues?: Record<string, number>;
  initial: EmulatedValue;
  /** Free-form provenance: whatever produced this model may record why this scalar exists. */
  usedBy: string[];
}

export interface EmulatedColumn {
  name: string;
  /** Column sub-identifier under the table's `Entry` node. */
  number: number;
  type: SnmpBaseType;
  readOnly: boolean;
  enumValues?: Record<string, number>;
}

export interface EmulatedTable {
  /** MIB identifier name of the table itself, e.g. `myAgentConnTable`. */
  name: string;
  /** OID of the table's `Entry` node — the OID a runtime registers a table provider at. */
  entryOid: string;
  columns: EmulatedColumn[];
  /**
   * Column names forming the row index, in index order. A table that `AUGMENTS` another is
   * indexed by the base row's index, so these names need not appear in `columns` — the index
   * values are supplied when a row is added, not served as columns of this table.
   */
  index: string[];
  /** Seed rows, one value per column in `columns` order. Empty until a consumer adds rows. */
  rows: Array<Array<number | string>>;
  usedBy: string[];
}

export interface EmulatedNotification {
  name: string;
  oid: string;
  /** Varbind objects the MIB declares this notification carries, in declaration order. */
  objects: string[];
}

/** An identifier a producer referenced that could not be modelled, and why. */
export interface ModelGap {
  identifier: string;
  reason: string;
  usedBy: string[];
}

export interface EmulatedAgentModel {
  subsystem: string;
  /** Provenance strings; a non-file-based producer may leave these empty. */
  confFile: string;
  smiFile: string;
  /** The SNMP version(s) this agent should be reachable at. */
  hostTypes: Array<{ name: string; version: string }>;
  scalars: EmulatedScalar[];
  tables: EmulatedTable[];
  notifications: EmulatedNotification[];
  /**
   * Identifiers the producer refused to model. A non-empty list is a finding about the input,
   * not a defect to paper over — a runtime serves the model it is given and the gaps stay
   * visible.
   */
  gaps: ModelGap[];
}

export interface ModelValidationError {
  /** Dotted path into the model, e.g. `tables[2].columns[0]`. */
  path: string;
  message: string;
}

/** Validates a model's internal consistency. Returns an empty array when the model is valid. */
export function validateModel(model: EmulatedAgentModel): ModelValidationError[];
