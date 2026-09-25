import { buildSelectionModel } from '@erkanbarin/snmp-adapter-selection';

const { SELECTION_PATH, MIB_PATH } = process.env;
if (!SELECTION_PATH || !MIB_PATH) throw new Error('SELECTION_PATH and MIB_PATH must be set');
const { model, gaps } = buildSelectionModel({ selectionPath: SELECTION_PATH, mibPath: MIB_PATH });
console.log(JSON.stringify({ model, gaps }, null, 2));