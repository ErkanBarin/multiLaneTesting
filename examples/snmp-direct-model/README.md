# Direct SNMP Model Example

This example runs a hand-authored `EmulatedAgentModel` without a selection-list adapter.

```sh
SNMP_EMULATOR_COMMUNITY=local-only npm run start
```

Set `SNMP_EMULATOR_PORT` to override the default UDP port. The runtime remains loopback-only by
default. Do not commit a real community value.