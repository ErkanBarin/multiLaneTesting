# @multilane/snmp-runtime

Controllable in-process SNMP agent runtime: `startEmulatedAgent(options)` stands an
`@multilane/snmp-model` `EmulatedAgentModel` up as a live `net-snmp` agent on loopback UDP and
returns a control plane (`set`, `addRow`, `removeRow`, `emit`, `goSilent`, `resume`, `close`).
`startTrapListener(options)` is the receiving half.

Works from direct model JSON alone — no selection import, no filesystem access, no adapter dependency.

No public registry is configured for `@multilane/*`; install from tarballs built in an engine
checkout. From a scaffolded consumer, run:

```sh
node <engine-repo>/scripts/install-tarballs.mjs .
```

The installer includes `@multilane/snmp-model` and other workspace dependencies in the same
consumer lockfile.

## Usage

```js
import { startEmulatedAgent } from '@multilane/snmp-runtime';

const agent = startEmulatedAgent({ model, port: 16161, community: 'my-test-community' });
agent.set('myAgentStatus', 'down');
agent.addRow('myConnTable', { myConnIndex: 1, myConnState: 'connected' });
await agent.emit('myStatusChange', { target: { port: 16162, community: 'my-test-community' } });
agent.close();
```

## Receiving traps

`startTrapListener` is **receive-only**: it never sends SNMP, never injects, and binds loopback
unless you widen `address` yourself. Pair it with `emit` to prove a notification contract without a
live dispatcher or the privileged UDP 162.

```js
import { startTrapListener } from '@multilane/snmp-runtime';

const listener = startTrapListener({ port: 16162 });
const trap = await listener.waitForTrap((n) => n.varbinds.some((vb) => vb.oid === MY_OID), 5000);
listener.close();
```

`waitForTrap` rejects on timeout **and** on `close()`, so a listener torn down in a `finally` fails
its pending waits instead of leaving them outstanding on a socket that can no longer receive.
Everything that arrived is also on `listener.received`, oldest first.

It accepts any community string. A passive observer that silently drops traps whose community it
did not predict hides the very traffic you asked it to watch — containment is the bind address, so
widen it only to somewhere that hears what it is meant to hear.

See `docs/snmp/api-contract.md` at the workspace root for the full frozen API surface, and
`docs/snmp/architecture.md` for this package's boundary rules — it is the only package in this
stream allowed to depend on `net-snmp`.
