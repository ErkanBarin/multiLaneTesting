# @multilane/snmp-adapter-selection

Converts a **selection list** plus SMI/MIB input into a validated `@multilane/snmp-model`
`EmulatedAgentModel`. It reads explicit content or files; it does not start an SNMP runtime.
It does not parse arbitrary vendor configuration formats. Unknown directives are reported as
gaps; a file with no recognized selections raises `SelectionAdapterError`.

```js
import { buildSelectionModel } from '@multilane/snmp-adapter-selection';

const { model, gaps } = buildSelectionModel({
  selectionText: 'subsystem demo\nhostType manager:v2c\nscalar demoStatus=operational',
  mibPath: process.env.MIB_PATH,
});
```

Inputs must be supplied as either content (`selectionText` / `mib`) or paths (`selectionPath` /
`mibPath`), never inferred from the current working directory. The supported selection
directives are `subsystem NAME`, `hostType NAME:VERSION`, `scalar NAME[=VALUE]`, `table NAME`,
and `notification NAME`. Unresolved or incompatible selections remain visible in `gaps`, and any
directive outside that list is reported as a gap too rather than silently dropped.