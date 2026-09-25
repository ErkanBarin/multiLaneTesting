import { validateModel } from '@erkanbarin/snmp-model';
import { startEmulatedAgent } from '@erkanbarin/snmp-runtime';

const model = {
  subsystem: 'direct-example', confFile: '', smiFile: '', hostTypes: [{ name: 'example', version: 'v2c' }],
  scalars: [{ name: 'exampleStatus', oid: '1.3.6.1.4.1.99999.1', readOnly: true, initial: { type: 'Integer', value: 1 }, usedBy: [] }],
  tables: [], notifications: [], gaps: [],
};
const errors = validateModel(model);
if (errors.length) throw new Error(errors.map(({ path, message }) => `${path}: ${message}`).join('\n'));

const port = Number(process.env.SNMP_EMULATOR_PORT ?? '16161');
const community = process.env.SNMP_EMULATOR_COMMUNITY;
if (!community) throw new Error('SNMP_EMULATOR_COMMUNITY must be set');
const agent = startEmulatedAgent({ model, port, community });
console.log(`SNMP emulator started on UDP port ${agent.port}; press Ctrl+C to stop.`);
process.once('SIGINT', () => agent.close());