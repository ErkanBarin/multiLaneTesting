# @erkanbarin/http

Passive HTTP/JSON contract lane for multilanetesting. Read-only shape/status checks — **never**
mutates target state. Zero third-party dependencies (Node built-ins only).

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getJson, assertShape } from '@erkanbarin/http';

const host = process.env.MULTILANE_TARGET_HOST;

test('health has the expected shape', { skip: !host }, async () => {
  const res = await getJson(host + '/health', {
    approvedHosts: (process.env.MULTILANE_APPROVED_HOSTS ?? '').split(',').filter(Boolean),
  });
  assert.equal(res.status, 200);
  assert.equal(assertShape(res.body, { status: 'string' }).ok, true);
});
```

`assertApprovedHost` refuses any host not on `MULTILANE_APPROVED_HOSTS` when the allowlist is set.
The host comes from `MULTILANE_TARGET_HOST` — no URL literal in committed specs.

**An empty allowlist allows every host, and this lane is the fail-open one.** The engine's rule is
that the allowlist guards *active* calls: `@erkanbarin/stomp`'s `send` mutates broker state and so
refuses outright when the list is empty, while its passive `subscribeOnce` has no host guard at all.
This lane only issues read-only GETs, which puts it on the passive side — the guard here is an
opt-in you switch on by populating the variable. It warns once per process when it is empty, so an
unset allowlist cannot be mistaken for an enforced one. Populate it in any environment where a test
target sits next to something you must not touch.
