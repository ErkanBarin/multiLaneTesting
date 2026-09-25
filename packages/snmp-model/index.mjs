// @erkanbarin/snmp-model — public API surface.
//
// Plain data types for an emulated SNMP agent, plus a structural validator. No `net-snmp`, no
// filesystem access, no producer-specific coupling: anything that builds an `EmulatedAgentModel`
// (a MIB/conf adapter, a hand-written fixture, or a JSON file) can be validated and consumed the
// same way.
export { validateModel } from './src/validate.mjs';
