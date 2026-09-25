# selection Adapter Example

Generate generic model JSON from explicit selection input paths:

```sh
SELECTION_PATH=/path/to/input.conf MIB_PATH=/path/to/input.mib npm run generate
```

The adapter does not search for files, start a server, or hide unresolved declarations. Inspect
the emitted `gaps` before passing the model to `@erkanbarin/snmp-runtime`.