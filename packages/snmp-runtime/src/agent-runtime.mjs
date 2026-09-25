// @erkanbarin/snmp-runtime — controllable agent runtime.
//
// Stands any `EmulatedAgentModel` up as a live SNMP agent on loopback UDP and gives a caller a
// control plane over it: change a value, add or remove a row, send a notification, stop
// answering. The surface comes entirely from the model — `set`, `addRow` and `emit` all take
// model identifier names and fail loudly on a name the model does not declare; `emit` builds its
// varbinds from the objects the model says the notification carries, so an emulated trap cannot
// carry a varbind set the model never specified.
import * as snmp from 'net-snmp';
import { createSocket } from 'node:dgram';

/** The ASN.1 tag for every SNMP base type the model declares. */
export const OBJECT_TYPE = {
  Integer: snmp.ObjectType.Integer,
  OctetString: snmp.ObjectType.OctetString,
  ObjectIdentifier: snmp.ObjectType.OID,
  IpAddress: snmp.ObjectType.IpAddress,
  Counter: snmp.ObjectType.Counter,
  Gauge: snmp.ObjectType.Gauge,
  TimeTicks: snmp.ObjectType.TimeTicks,
  Counter64: snmp.ObjectType.Counter64,
};

function defaultFor(type, enumValues) {
  if (enumValues) return Math.min(...Object.values(enumValues));
  switch (type) {
    case 'OctetString':
      return '';
    case 'ObjectIdentifier':
      return '0.0';
    case 'IpAddress':
      return '127.0.0.1';
    default:
      return 0;
  }
}

/** Accept an enumeration label wherever the model declares one. */
function resolve(value, enumValues) {
  if (typeof value === 'string' && enumValues && value in enumValues) return enumValues[value];
  return value;
}

/** The instance sub-identifiers an index value contributes, per SMIv2 index encoding. */
function indexSuffix(type, value) {
  if (type !== 'OctetString') return [Number(value)];
  const text = String(value);
  return [text.length, ...[...text].map((c) => c.charCodeAt(0))];
}

/**
 * @param {import('../index.d.ts').AgentRuntimeOptions} options
 * @returns {import('../index.d.ts').EmulatedAgent}
 */
export function startEmulatedAgent(options) {
  const { model } = options;
  const unserved = [];
  const scalarState = new Map();
  const rowState = new Map();
  let silent = false;

  // Drop the datagram rather than close the socket: a device that has stopped answering produces
  // a poll timeout, whereas an unbound port produces an immediate ICMP rejection instead.
  const dgramModule = {
    createSocket(type) {
      const socket = createSocket(type);
      const on = socket.on.bind(socket);
      socket.on = (event, listener) =>
        event === 'message'
          ? on('message', (...args) => {
              if (!silent) listener(...args);
            })
          : on(event, listener);
      return socket;
    },
  };

  const agent = snmp.createAgent({ port: options.port, address: options.address ?? '127.0.0.1', dgramModule }, (error) => {
    if (error) console.error(`[emulator:${model.subsystem}] ${error.message}`);
  });

  agent.getAuthorizer().addCommunity(options.community);
  const mib = agent.getMib();
  const access = (readOnly) => (!readOnly && options.writable === true ? snmp.MaxAccess['read-write'] : snmp.MaxAccess['read-only']);

  /** A half-built agent still owns its bound UDP socket, which would keep the process alive. */
  const failFast = (error) => {
    agent.close();
    throw error;
  };

  try {
    for (const scalar of model.scalars) {
      const override = options.typeOverrides?.[scalar.name];
      const type = override?.type ?? scalar.initial.type;
      mib.registerProvider({
        name: scalar.name,
        type: snmp.MibProviderType.Scalar,
        oid: scalar.oid,
        scalarType: OBJECT_TYPE[type],
        maxAccess: access(scalar.readOnly),
      });
      // An override is the whole point of a non-conformant agent, so its value is served as given
      // — resolving an enumeration label here would hand back the very Integer it must not be.
      const value =
        override === undefined ? resolve(options.seed?.scalars?.[scalar.name] ?? scalar.initial.value, scalar.enumValues) : override.value;
      scalarState.set(scalar.name, value);
      mib.setScalarValue(scalar.name, value);
    }
  } catch (error) {
    failFast(error);
  }

  // A table whose INDEX lives in another table (an AUGMENTS chain, or the hierarchical indices of
  // a chassis MIB) can only resolve once that other table is registered, so the self-indexed ones
  // go first.
  const byName = new Map(model.tables.map((t) => [t.name, t]));
  const selfIndexed = (t) => t.index.every((i) => t.columns.some((c) => c.name === i));
  const registered = new Set();
  for (const table of [...model.tables].sort((a, b) => Number(selfIndexed(b)) - Number(selfIndexed(a)))) {
    try {
      mib.registerProvider({
        name: table.name,
        type: snmp.MibProviderType.Table,
        oid: table.entryOid,
        maxAccess: snmp.MaxAccess['not-accessible'],
        tableColumns: table.columns.map((column) => ({
          number: column.number,
          name: column.name,
          type: OBJECT_TYPE[column.type],
          maxAccess: access(column.readOnly),
        })),
        tableIndex: table.index.map((columnName) => ({ columnName })),
      });
      registered.add(table.name);
      rowState.set(table.name, new Map());
    } catch (error) {
      unserved.push({ table: table.name, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  const tableOf = (name) => {
    const table = byName.get(name);
    if (!table) throw new Error(`${model.subsystem}: no table "${name}" in the model`);
    if (!registered.has(name)) throw new Error(`${model.subsystem}: table "${name}" is unserved`);
    return table;
  };

  /** Index values first (they may be foreign), then one value per declared column. */
  const rowArray = (table, values) => {
    for (const name of table.index) {
      if (values[name] === undefined) throw new Error(`${table.name}: index column "${name}" has no value`);
    }
    const row = table.index.filter((i) => !table.columns.some((c) => c.name === i)).map((name) => values[name]);
    for (const column of table.columns) {
      row.push(resolve(values[column.name] ?? defaultFor(column.type, column.enumValues), column.enumValues));
    }
    return row;
  };

  const indexKey = (table, values) => table.index.map((name) => String(values[name])).join('\u0000');

  const columnOf = (name) => {
    for (const table of model.tables) {
      const column = table.columns.find((c) => c.name === name);
      if (column) return { table, number: column.number, type: column.type };
    }
    return null;
  };

  const sendTrap = async (oid, varbinds, target) => {
    // net-snmp sends notifications to `trapPort`, not to the session's `port`.
    const session = snmp.createSession(target.host ?? '127.0.0.1', target.community, {
      trapPort: target.port,
      version: snmp.Version2c,
    });
    await new Promise((resolveTrap, reject) => {
      session.trap(oid, varbinds, (error) => {
        session.close();
        if (error) reject(error);
        else resolveTrap();
      });
    });
  };

  try {
    for (const [name, rows] of Object.entries(options.seed?.tables ?? {})) {
      for (const values of rows) {
        const table = tableOf(name);
        mib.addTableRow(table.name, rowArray(table, values));
        rowState.get(table.name)?.set(indexKey(table, values), { ...values });
      }
    }
  } catch (error) {
    failFast(error);
  }

  return {
    port: options.port,
    model,
    unserved,

    set(name, value) {
      const scalar = model.scalars.find((s) => s.name === name);
      if (!scalar) throw new Error(`${model.subsystem}: no scalar "${name}" in the model`);
      const resolved = resolve(value, scalar.enumValues);
      scalarState.set(name, resolved);
      mib.setScalarValue(name, resolved);
    },

    addRow(name, values) {
      const table = tableOf(name);
      mib.addTableRow(table.name, rowArray(table, values));
      rowState.get(table.name)?.set(indexKey(table, values), { ...values });
    },

    removeRow(name, index) {
      const table = tableOf(name);
      mib.deleteTableRow(table.name, index);
      rowState.get(table.name)?.delete(index.map(String).join('\u0000'));
    },

    async emit(name, emitOptions) {
      const notification = model.notifications.find((n) => n.name === name);
      if (!notification) throw new Error(`${model.subsystem}: no notification "${name}" in the model`);
      const target = emitOptions?.target ?? options.trapTarget;
      if (!target) throw new Error(`${model.subsystem}: emit("${name}") needs a trap target`);

      const varbinds = notification.objects.map((objectName) => {
        const override = emitOptions?.values?.[objectName];
        const scalar = model.scalars.find((s) => s.name === objectName);
        if (scalar) {
          const value = resolve(override ?? scalarState.get(objectName) ?? scalar.initial.value, scalar.enumValues);
          return { oid: `${scalar.oid}.0`, type: OBJECT_TYPE[scalar.initial.type], value };
        }
        const column = columnOf(objectName);
        if (!column) throw new Error(`${model.subsystem}: ${name} declares "${objectName}", which the model does not serve`);
        const index = emitOptions?.index;
        if (index === undefined) throw new Error(`${model.subsystem}: ${name} carries the row object "${objectName}" — emit needs an index`);
        const suffix = column.table.index.flatMap((columnName, position) => {
          const indexColumn = column.table.columns.find((c) => c.name === columnName);
          return indexSuffix(indexColumn?.type ?? 'OctetString', index[position] ?? '');
        });
        const key = index.map(String).join('\u0000');
        const current = rowState.get(column.table.name)?.get(key)?.[objectName];
        const declared = column.table.columns.find((c) => c.name === objectName);
        return {
          oid: [column.table.entryOid, column.number, ...suffix].join('.'),
          type: OBJECT_TYPE[column.type],
          value: resolve(override ?? current ?? defaultFor(column.type, declared?.enumValues), declared?.enumValues),
        };
      });

      await sendTrap(notification.oid, varbinds, target);
    },

    goSilent() {
      silent = true;
    },

    resume() {
      silent = false;
    },

    close() {
      agent.close();
    },
  };
}
