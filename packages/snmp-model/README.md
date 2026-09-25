# @multilane/snmp-model

Pure data model for an emulated SNMP agent: `EmulatedAgentModel` and its nested scalar/table/
notification/gap types, plus `validateModel` for structural checks (duplicate names/OIDs, index
columns, row/column shape, notification object references).

No `net-snmp`, no filesystem access, no coupling to any particular producer (MIB adapter,
hand-written fixture, or JSON file) — anything that can build an `EmulatedAgentModel` object can
use this package.

## Usage

```js
import { validateModel } from '@multilane/snmp-model';

const errors = validateModel(model);
if (errors.length > 0) {
  throw new Error(errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
}
```

See `docs/snmp/api-contract.md` at the workspace root for the full frozen API surface, and
`docs/snmp/architecture.md` for this package's boundary rules relative to `@multilane/snmp-runtime`
and `@multilane/snmp-adapter-selection`.
