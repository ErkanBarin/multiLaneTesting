// @multilane/snmp-runtime — passive trap listener.
//
// Receive-only, and deliberately so: this module never sends SNMP to any host, never binds beyond
// the address it is given, and performs no SET or trap injection. It is the receiving half of the
// runtime — `startEmulatedAgent(...).emit()` is the sending half — so a consumer can prove a
// notification contract end to end on loopback without a live dispatcher or UDP 162 privileges.
import * as snmp from 'net-snmp';

/**
 * @param {import('../index.d.ts').TrapListenerOptions} options
 * @returns {import('../index.d.ts').TrapListener}
 */
export function startTrapListener(options) {
  const address = options.address ?? '127.0.0.1';
  const received = [];
  /** @type {Array<{ predicate: Function, resolve: Function, reject: Function }>} */
  const waiters = [];

  const receiver = snmp.createReceiver(
    {
      port: options.port,
      address,
      transport: 'udp4',
      // Accept any community: a passive observer that silently drops traps whose community it did
      // not predict is worse than one that reports what actually arrived. Containment comes from
      // the loopback default above, not from guessing credentials. Authorizing a live listener is
      // the consumer's call — bind it somewhere it can only hear what it is meant to hear.
      disableAuthorization: true,
    },
    (error, notification) => {
      if (error || !notification) return;
      const mapped = {
        varbinds: notification.pdu.varbinds.map((vb) => ({ oid: vb.oid, value: vb.value })),
        source: { address: notification.rinfo.address, port: notification.rinfo.port },
      };
      received.push(mapped);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].predicate(mapped)) waiters.splice(i, 1)[0].resolve(mapped);
      }
    },
  );

  return {
    port: options.port,
    address,
    received,
    waitForTrap(predicate, timeoutMs) {
      const already = received.find(predicate);
      if (already) return Promise.resolve(already);
      return new Promise((resolve, reject) => {
        // Failure timeout, not a synchronization sleep: arrival itself resolves immediately.
        const failTimer = setTimeout(() => {
          const i = waiters.indexOf(waiter);
          if (i >= 0) waiters.splice(i, 1);
          reject(new Error(`no matching trap received within ${timeoutMs}ms`));
        }, timeoutMs);
        const settle = (fn) => (arg) => {
          clearTimeout(failTimer);
          fn(arg);
        };
        const waiter = { predicate, resolve: settle(resolve), reject: settle(reject) };
        waiters.push(waiter);
      });
    },
    close() {
      receiver.close();
      // Closing with a wait outstanding must fail it now. Leaving it to time out hangs the caller
      // on a listener that can no longer receive anything, and holds the timer open with it.
      while (waiters.length > 0) {
        waiters.pop().reject(new Error('trap listener closed while waiting for a trap'));
      }
    },
  };
}
