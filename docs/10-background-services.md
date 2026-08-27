# Background services

Export `createService` from your server entry to run periodic work: polling an
external API, firing deadlines, refreshing a cache.

```ts
export function createService(deps: FeatureServiceDeps): FeatureService {
    return deps.createTicker({
        intervalMs: 60_000,
        async tick() {
            for (const workspaceId of await deps.listWorkspaceIds()) {
                const store = deps.storeFor(workspaceId);
                ...
            }
        }
    });
}
```

`createTicker` is the app's standard loop: an interval, a reentrancy guard (a
slow tick is never overlapped by the next), errors logged and swallowed so one
bad tick never kills the service. Use it instead of rolling your own; there is
no cron, no queue, and that is a deliberate choice of the host.

A service is `{ start, stop }`. `start()` may be async: DevEye awaits it during
boot, before the agent sockets open, and calls `stop()` on shutdown. The
service object is also what carries your `providers` (and, for DevEye's own
modules, `agentHooks`); to offer those without any periodic work, return
`{ start() {}, stop() {}, providers }`. To combine a ticker with them, keep the
ticker and delegate: `{ start: () => ticker.start(), stop: () => ticker.stop(), providers }`.

## The deps, and what is missing

`repo`, `listWorkspaceIds()`, `storeFor(workspaceId)`, `cipherFor(workspaceId)`,
`deveyeFor(workspaceId)` (notify only), `devicesFor(workspaceId)` (`list` and
`isOnline`, capability `'devices.read'`), `devices` (`find(id)` and
`isOnline`, the whole fleet, same capability), `telemetry` (reserved,
capability `'telemetry.read'`), `live.changed(workspaceId)` (your topic,
from a service: see [09-live](09-live.md#writes-without-a-command)),
`audit(entry)` (recorded as the system; pass `userId` when the work concerns
one user's data), `keys` (raw key wrapping,
[below](#wrapping-key-material-of-your-own-depskeys)), `agents` (reserved,
[below](#the-agent-fleet-reserved)), `createTicker`, `logger`.

No user, no session, no `'private'` tier: the sessionless store cannot write
private values (the type refuses), and reading one throws `locked`. If your
scheduler needs a value, store it with the default `'server'` encryption. This
is the platform's encryption promise, not a missing feature.

## Discipline that keeps hosts happy

- Bound each tick: batch, or bail early when there is nothing to do.
- Mark work as done **before** long side effects when replaying would be worse
  than skipping (a crashed tick must not re-send yesterday's alerts).
- Log with `deps.logger` and let the ticker swallow: a service that throws its
  way out of existence takes your feature's freshness with it.

## Devices, from a service

`deps.devicesFor(workspaceId)` is the sessionless subset of the devices facade:
`list()` (each device with its live `online` flag) and `isOnline(id)`, no
`authorize` (authorizing a device id the client sent is a request-time
decision, made in a handler). Same gate as in handlers: without
`'devices.read'` in the manifest, every call throws `forbidden`.

## Wrapping key material of your own: `deps.keys`

`ctx.cipher()` and the store already encrypt strings for you. `deps.keys` is
for the one case they do not cover: a module that runs its own bulk encryption
(files, streams) and therefore owns a raw symmetric key. You generate it once,
persist it wrapped under the server key, and unwrap it at `start()`:

```ts
import { randomBytes } from 'node:crypto';

const store = deps.storeFor(workspaceId);
const wrapped = await store.get('blobKey');
let raw: Uint8Array;
if (wrapped === null) {
    raw = randomBytes(32);
    // Already ciphertext: 'none' stores the sealed string as is.
    await store.put('blobKey', deps.keys.sealBytes(raw), { encryption: 'none' });
} else {
    const opened = deps.keys.openBytes(wrapped);
    if (opened === null) throw new Error('blob key cannot be unwrapped: server keys changed?');
    raw = opened;
}
```

- `sealBytes(plain: Uint8Array): string` seals under the SERVER key, in the
  app's own wire format; `openBytes(sealed: string): Uint8Array | null`
  reverses it, and answers `null` when the blob was tampered with or the
  server keys changed. Treat `null` as fatal for that key and say so loudly:
  generating a fresh one would silently make everything sealed under the old
  one unreadable.
- Key material only, never user data: user data goes through the ciphers and
  the store, whose tiers (`'server'`, `'private'`) the server key knows nothing
  about.
- Service deps only: there is no `keys` on the handler context. Unwrap at
  `start()`, keep the raw key in memory, hand it to your handlers yourself.

## Offering a contract to the host: `providers`

Sometimes DevEye's own code needs data a module owns (its Backup feature
archives CloudSync shares). The dependency is inverted so the app never
imports a module: the app publishes the contract it consumes as a key and an
interface in `@deveye/types/sdk` (`providers.ts`), the module implements the
interface on its service under that key, and the app looks it up at call
time:

```ts
import { CLOUDSYNC_BACKUP_PROVIDER, type CloudSyncBackupProvider } from '@deveye/types/sdk';

createService(deps) {
    const backup: CloudSyncBackupProvider = { findShare, listShares, statsByShare, listPresentFiles, openBlob };
    return { start() {}, stop() {}, providers: { [CLOUDSYNC_BACKUP_PROVIDER]: backup } };
}
```

App-side, `moduleProvider(key)` walks the installed modules' services in
installation order and returns the first value found under that key, or
`undefined`; the caller then degrades cleanly (Backup fails the run with a
clean "module not installed" error and hides that source kind in its UI). What
it means for you:

- You can only fill a contract the host already knows: a key nothing looks up
  is inert. The published contracts today: `CLOUDSYNC_BACKUP_PROVIDER`
  (`'cloudsync.backup'`, interface `CloudSyncBackupProvider`),
  `UPTIME_ITEMS_PROVIDER` (`'uptime.items'`, `UptimeItemsProvider`, what the
  Projects feature asks before linking a service), `SENTINEL_AGENT_CONFIG_PROVIDER`
  (`'sentinel.agentConfig'`, `SentinelAgentConfigProvider`, what Sentinel
  contributes to the config pushed to an agent). Proposing a new one is a
  change to `@deveye/types`, hence a pull request against DevEye. The client
  twin (`FeatureClient.providers`, `UPTIME_CLIENT_PROVIDER`) lets an app
  screen compose a module's components the same way ([05-client](05-client.md#offering-components-to-the-host-providers)).
- Providers live on the service: a module that offers one exports
  `createService`, even with no ticker.
- The app calls a provider without a session, like every service: only
  `'server'`-tier data can serve it.

## The agent fleet (reserved)

DevEye installs an agent on the workspace's devices, and one native feature
migrated onto this contract (CloudSync, the folder sync) drives it. The surface
is in the SDK types so that a native module can be built out of tree, and it
is reserved to native-id modules: `validateManifest` refuses
`nativeCapabilities: ['agents']` on an `x-` id. The agent protocol is app
infrastructure, the contract between DevEye and its own agent binary; the
payload types the facade takes come from `@deveye/types` itself, outside the
`sdk*` entries whose stability the SDK promises, so a third-party module
cannot depend on them. What a module may know about devices is
`'devices.read'`, above. For the record, what the capability opens:

- `ctx.deveye.agents` and `deps.agents` (`AgentsFacade`): `isOnline`,
  `requestScan` (an immediate security scan), `pushConfig` (the device's
  collection config, recomposed by the app from the device row and the
  modules' contributions), nine outbound `requestSync*` calls that answer
  `false` when the agent is offline (frame dropped, never queued), and
  `publishSyncProgress` / `publishSyncState`, the fan-out to the browsers
  subscribed to a share.
- `ctx.transport` (`SdkSocketTransport`): the caller's own browser socket,
  `subscribeSync` / `unsubscribeSync`, and chunked downloads with backpressure
  (`sendSyncChunk` returns the socket's send-buffer size after the frame,
  `syncChunkBuffered` reads it). Every method throws `forbidden` without the
  capability.
- `FeatureService.agentHooks` (`FeatureAgentHooks`): the inbound side,
  `onAgentConnect`, `onAgentOffline`, the telemetry once the app has
  persisted it (`onReport`, `onMetricsBatch`, `onIntegrity`, `onAuthEvents`;
  only for active devices, and whether a device is watched by your feature
  is your decision), `onSyncChanged`, `onSyncIndex`, `onSyncChunk`,
  `onSyncAck`, `onSyncOpResult`. Every hook is optional; an
  absent one is a no-op. The app aggregates the hooks of every module that
  declares `'agents'` and calls each in isolation: a throw or a rejection in
  one module is logged by the host (`{ err, module, hook }`) and reaches
  neither the other modules nor the socket layer. You do not need to catch to
  be safe, but a failed hook loses that frame for your module. Hooks may fire
  before your `start()` has completed: drop the event quietly, the agent
  resends or reconciles. `deviceId` is the socket's authenticated identity;
  the copy inside the payload is not trusted.
