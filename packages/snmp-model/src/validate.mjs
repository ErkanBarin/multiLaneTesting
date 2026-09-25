// @erkanbarin/snmp-model — structural validation.
//
// Checks internal consistency only: this never reaches into a filesystem or a producer's own
// input, so the same checks apply whether the model came from a MIB adapter, a hand-written
// fixture, or a JSON file on disk.

/**
 * @param {import('../index.d.ts').EmulatedAgentModel} model
 * @returns {import('../index.d.ts').ModelValidationError[]}
 */
export function validateModel(model) {
  const errors = [];
  const push = (path, message) => errors.push({ path, message });

  const scalarNames = new Set();
  const scalarOids = new Set();
  for (const [i, scalar] of model.scalars.entries()) {
    const path = `scalars[${i}]`;
    if (scalarNames.has(scalar.name)) push(path, `duplicate scalar name "${scalar.name}"`);
    scalarNames.add(scalar.name);
    if (scalarOids.has(scalar.oid)) push(path, `duplicate scalar OID "${scalar.oid}"`);
    scalarOids.add(scalar.oid);
  }

  const tableNames = new Set();
  const entryOids = new Set();
  const columnNamesByTable = new Map();
  for (const [i, table] of model.tables.entries()) {
    const path = `tables[${i}]`;
    if (tableNames.has(table.name)) push(path, `duplicate table name "${table.name}"`);
    tableNames.add(table.name);
    if (entryOids.has(table.entryOid)) push(path, `duplicate table entryOid "${table.entryOid}"`);
    entryOids.add(table.entryOid);

    const columnNames = new Set();
    const columnNumbers = new Set();
    for (const [j, column] of table.columns.entries()) {
      const columnPath = `${path}.columns[${j}]`;
      if (columnNames.has(column.name)) push(columnPath, `duplicate column name "${column.name}" in table "${table.name}"`);
      columnNames.add(column.name);
      if (columnNumbers.has(column.number)) push(columnPath, `duplicate column number ${column.number} in table "${table.name}"`);
      columnNumbers.add(column.number);
    }
    columnNamesByTable.set(table.name, columnNames);

    if (table.index.length === 0) push(path, `table "${table.name}" declares no index columns`);

    for (const [k, row] of table.rows.entries()) {
      if (row.length !== table.columns.length) {
        push(`${path}.rows[${k}]`, `row has ${row.length} values, table "${table.name}" declares ${table.columns.length} columns`);
      }
    }
  }

  const notificationNames = new Set();
  const notificationOids = new Set();
  const knownObject = (name) => scalarNames.has(name) || [...columnNamesByTable.values()].some((cols) => cols.has(name));
  for (const [i, notification] of model.notifications.entries()) {
    const path = `notifications[${i}]`;
    if (notificationNames.has(notification.name)) push(path, `duplicate notification name "${notification.name}"`);
    notificationNames.add(notification.name);
    if (notificationOids.has(notification.oid)) push(path, `duplicate notification OID "${notification.oid}"`);
    notificationOids.add(notification.oid);

    for (const [j, object] of notification.objects.entries()) {
      if (!knownObject(object)) {
        push(`${path}.objects[${j}]`, `notification "${notification.name}" carries "${object}", which no scalar or table column declares`);
      }
    }
  }

  return errors;
}
