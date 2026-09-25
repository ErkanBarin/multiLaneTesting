import { readFileSync } from 'node:fs';
import { validateModel } from '@erkanbarin/snmp-model';

const ROOT_OIDS = {
  iso: '1',
  org: '1.3',
  dod: '1.3.6',
  internet: '1.3.6.1',
  private: '1.3.6.1.4',
  enterprises: '1.3.6.1.4.1',
};

export class SelectionAdapterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SelectionAdapterError';
  }
}

function inputContent(content, path, label) {
  if ((content === undefined) === (path === undefined)) {
    throw new SelectionAdapterError(`provide exactly one of ${label} or ${label}Path`);
  }
  return content ?? readFileSync(path, 'utf8');
}

function parseSelections(content) {
  const parsed = { subsystem: undefined, hostTypes: [], selections: new Map(), unknown: new Set() };
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/(?:#|--).*$/, '').trim();
    if (!line) continue;
    const [directive, remainder = ''] = line.split(/\s+/, 2);
    if (directive === 'subsystem') parsed.subsystem = remainder.trim();
    else if (directive === 'hostType') {
      const [name, version] = remainder.trim().split(':', 2);
      if (name && version) parsed.hostTypes.push({ name, version });
      else parsed.unknown.add('hostType');
    } else if (['scalar', 'table', 'notification'].includes(directive)) {
      const [name, value] = remainder.trim().split('=', 2);
      if (name) parsed.selections.set(name.trim(), { kind: directive, value: value?.trim() });
    } else parsed.unknown.add(directive);
  }
  return parsed;
}

function normalizeType(syntax = '') {
  const normalized = syntax.replace(/\s+/g, ' ').trim();
  if (/^(INTEGER|Integer32)\b/i.test(normalized)) return 'Integer';
  if (/^OCTET STRING\b|^DisplayString\b/i.test(normalized)) return 'OctetString';
  if (/^OBJECT IDENTIFIER\b/i.test(normalized)) return 'ObjectIdentifier';
  if (/^IpAddress\b/i.test(normalized)) return 'IpAddress';
  if (/^Counter64\b/i.test(normalized)) return 'Counter64';
  if (/^Counter32\b|^Counter\b/i.test(normalized)) return 'Counter';
  if (/^Gauge32\b|^Gauge\b|^Unsigned32\b/i.test(normalized)) return 'Gauge';
  if (/^TimeTicks\b/i.test(normalized)) return 'TimeTicks';
  return undefined;
}

function enumValues(syntax = '') {
  const result = {};
  for (const match of syntax.matchAll(/([A-Za-z][\w-]*)\s*\(\s*(-?\d+)\s*\)/g)) result[match[1]] = Number(match[2]);
  return Object.keys(result).length ? result : undefined;
}

function parseDeclarations(mib) {
  const declarations = new Map();
  const expression = /([A-Za-z][\w-]*)\s+(OBJECT-TYPE|NOTIFICATION-TYPE|OBJECT IDENTIFIER)\s*([\s\S]*?)::=\s*\{\s*([^}]+)\s*\}/g;
  for (const match of mib.matchAll(expression)) {
    const [, name, kind, body, assignment] = match;
    const oidParts = assignment.trim().split(/\s+/);
    const number = Number(oidParts.at(-1));
    if (!Number.isInteger(number)) continue;
    const syntax = body.match(/SYNTAX\s+([\s\S]*?)(?=\n\s*(?:MAX-ACCESS|ACCESS|STATUS|DESCRIPTION|INDEX|OBJECTS)\b|$)/i)?.[1]?.trim();
    const access = body.match(/(?:MAX-ACCESS|ACCESS)\s+([\w-]+)/i)?.[1];
    const index = body.match(/INDEX\s*\{\s*([^}]+)\s*\}/i)?.[1].split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const objects = body.match(/OBJECTS\s*\{\s*([^}]+)\s*\}/i)?.[1].split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    declarations.set(name, {
      name,
      kind,
      parent: oidParts.slice(0, -1).join(' '),
      number,
      syntax,
      type: normalizeType(syntax),
      enumValues: enumValues(syntax),
      readOnly: !/read-write|read-create/i.test(access ?? ''),
      index,
      objects,
    });
  }

  const resolving = new Set();
  function oidFor(name) {
    if (ROOT_OIDS[name]) return ROOT_OIDS[name];
    const declaration = declarations.get(name);
    if (!declaration || declaration.oid || resolving.has(name)) return declaration?.oid;
    resolving.add(name);
    const parent = oidFor(declaration.parent);
    resolving.delete(name);
    if (parent) declaration.oid = `${parent}.${declaration.number}`;
    return declaration.oid;
  }
  for (const name of declarations.keys()) oidFor(name);
  return declarations;
}

function parsedValue(value, type, enums) {
  if (value === undefined) return type === 'Integer' ? { type, value: 0 } : { type, value: '' };
  if (enums?.[value] !== undefined) return { type, value: enums[value], enumLabel: value };
  const parsed = type === 'Integer' || type === 'Counter' || type === 'Gauge' || type === 'TimeTicks' || type === 'Counter64' ? Number(value) : value;
  if (typeof parsed === 'number' && Number.isNaN(parsed)) throw new SelectionAdapterError(`invalid ${type} value "${value}"`);
  return { type, value: parsed };
}

function tableFrom(declaration, declarations, usedBy) {
  const entry = [...declarations.values()].find((candidate) => candidate.parent === declaration.name && candidate.index.length > 0);
  if (!entry?.oid) return undefined;
  const columns = [...declarations.values()]
    .filter((candidate) => candidate.parent === entry.name && candidate.type)
    .sort((left, right) => left.number - right.number)
    .map((column) => ({ name: column.name, number: column.number, type: column.type, readOnly: column.readOnly, ...(column.enumValues && { enumValues: column.enumValues }) }));
  if (!columns.length) return undefined;
  return { name: declaration.name, entryOid: entry.oid, columns, index: entry.index, rows: [], usedBy };
}

export function buildSelectionModel(options) {
  const selectionText = inputContent(options.selectionText, options.selectionPath, 'selectionText');
  const mib = inputContent(options.mib, options.mibPath, 'mib');
  const selections = parseSelections(selectionText);

  if (selections.selections.size === 0 && selections.unknown.size > 0) {
    throw new SelectionAdapterError(
      `no selections recognised in selectionText; unsupported directive(s): ${[...selections.unknown].sort().join(', ')}. ` +
        'Use scalar, table, or notification directives naming MIB identifiers.',
    );
  }

  const declarations = parseDeclarations(mib);
  const confFile = options.selectionPath ?? '';
  const smiFile = options.mibPath ?? '';
  const usedBy = confFile ? [confFile] : [];
  const model = {
    subsystem: options.subsystem ?? selections.subsystem ?? 'selection',
    confFile,
    smiFile,
    hostTypes: selections.hostTypes,
    scalars: [],
    tables: [],
    notifications: [],
    gaps: [],
  };

  for (const [name, selection] of selections.selections) {
    const declaration = declarations.get(name);
    if (!declaration?.oid) {
      model.gaps.push({ identifier: name, reason: declaration ? 'OID cannot be resolved from loaded SMI/MIB declarations' : 'not declared in loaded SMI/MIB input', usedBy });
      continue;
    }
    if (selection.kind === 'scalar' && declaration.kind === 'OBJECT-TYPE' && declaration.type) {
      model.scalars.push({ name, oid: declaration.oid, readOnly: declaration.readOnly, ...(declaration.enumValues && { enumValues: declaration.enumValues }), initial: parsedValue(selection.value, declaration.type, declaration.enumValues), usedBy });
    } else if (selection.kind === 'table') {
      const table = tableFrom(declaration, declarations, usedBy);
      if (table) model.tables.push(table);
      else model.gaps.push({ identifier: name, reason: 'does not resolve to a table with a modelled entry and columns', usedBy });
    } else if (selection.kind === 'notification' && declaration.kind === 'NOTIFICATION-TYPE') {
      model.notifications.push({ name, oid: declaration.oid, objects: declaration.objects });
    } else {
      model.gaps.push({ identifier: name, reason: `${selection.kind} selection is incompatible with its SMI/MIB declaration`, usedBy });
    }
  }

  for (const directive of [...selections.unknown].sort()) {
    model.gaps.push({ identifier: directive, reason: 'unsupported selection directive — lines using it were ignored', usedBy });
  }

  const errors = validateModel(model);
  if (errors.length) throw new SelectionAdapterError(errors.map(({ path, message }) => `${path}: ${message}`).join('; '));
  return { model, gaps: model.gaps, debug: { selectedIdentifiers: [...selections.selections.keys()] } };
}