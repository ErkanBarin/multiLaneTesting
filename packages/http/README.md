# @multilane/http

Passive HTTP/JSON contract lane for multilanetesting. Read-only shape/status checks — **never**
mutates target state. Zero third-party dependencies (Node built-ins only).

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getJson, assertShape } from '@multilane/http';

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
