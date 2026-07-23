# @multilane/stomp

STOMP-over-WebSocket contract lane for multilanetesting.

- **Passive SUBSCRIBE** is the default: `subscribeOnce(url, destination)` resolves with the first
  frame, or rejects on timeout.
- **Active SEND** is supervised: `send(...)` refuses unless `inject: true` **and** the host is on the
  approved-hosts allowlist (the two-flag opt-in: `MULTILANE_WS_INJECT=1` + preflight).

```js
import { subscribeOnce } from '@multilane/stomp';

const url = process.env.MULTILANE_WS_URL;
const msg = await subscribeOnce(url, '/topic/status', { timeoutMs: 5000 });
```

Peer dependencies: `@stomp/stompjs`, `ws` (imported lazily). The URL comes from `MULTILANE_WS_URL` —
no endpoint literal in committed specs.
