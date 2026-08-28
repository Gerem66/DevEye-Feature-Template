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
one user's data), `keys` (raw key wrapping and derivation,
[below](#wrapping-key-material-of-your-own-depskeys)), `secrecy`
(`redeem(ticket)`, [below](#tickets-a-public-route-acting-for-a-session)),
`origins` (`{ app, public }`, the same a handler gets as `ctx.origins`),
`providers` (`get<T>(key)`, [below](#consuming-a-contract-providersget)),
`agents` (reserved, [below](#the-agent-fleet-reserved)), `createTicker`,
`logger`.

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
- `derive(salt: string, info: string, length: number): Uint8Array` yields a
  key DERIVED from the server key (HKDF-SHA256 over the same material as
  `sealBytes`), never stored anywhere: for material that must survive the
  database, since a key kept in a table would sit inside the very backup it
  protects. The same `(salt, info)` always yields the same key as long as
  `CRYPT_KEY_A` / `CRYPT_KEY_B` do not change; it is also the salt of a module
  that hashes something (a visitor id), never `CRYPT_KEY_A` itself.
- Key material only, never user data: user data goes through the ciphers and
  the store, whose tiers (`'server'`, `'private'`) the server key knows nothing
  about.
- Handlers get the same object as `ctx.keys`, so a request can derive or
  unwrap at its own pace. A key a service works with is still best unwrapped
  once at `start()` and kept in memory.

## Public HTTP routes: `publicRoutes`

Some features are fed from outside: an analytics beacon posted by browsers
that know nothing of DevEye, from sites that are not DevEye's. That is the one
case where a module opens a door without a session, and it is declared for
that reason: `nativeCapabilities: ['routes.public']` in the manifest (an
administrator reviews it before installing), then `publicRoutes(app)` on the
service object, next to `providers`:

```ts
createService(deps) {
    return {
        start() {},
        stop() {},
        publicRoutes(app: SdkPublicApp) {
            app.get('/t.js', {}, async (_req, reply) => {
                return reply.header('Content-Type', 'application/javascript').send(SCRIPT);
            });
            app.post('/api/t/b', { rateLimit: { max: 120, timeWindow: '1 minute' } }, async (req, reply) => {
                const body = schema.safeParse(req.body);   // req.body: JSON, already decoded
                if (body.success) queue.push(req.ip, body.data);
                return reply.code(204).send();              // always 204: nothing to infer from it
            });
        }
    };
}
```

- Paths are absolute; a path the host already serves is refused at boot.
- The host calls `publicRoutes` once **per listener** it exposes to the
  outside (the app, and the public surface when it has one): register the
  same routes each time, and keep the handler free of per-listener state.
- CORS is open on these routes, on purpose: they are meant for other
  origins. Whatever gate you need (a public key, an origin allowlist, a
  rate limit) is yours to enforce in the handler; `rateLimit` adds a
  per-address ceiling on top of the host's own.
- `exposure` picks the listeners: `'everywhere'` (default) serves the route
  on the app and on the public surface, for what the outside world calls (a
  beacon); `'app'` serves it on the app's own origin only, for what the
  logged-in browser fetches without a session header (a ticketed download,
  an OAuth callback that lands back in the app).
- `req` is `{ headers, body, ip }` and nothing else: no user, no workspace,
  no `'private'` tier. Route the request from what it carries (a key in the
  body) to the workspace it belongs to, through your repo.
- The reply surface is minimal and chainable: `header(name, value)`,
  `code(status)`, `send(payload?)`.
- What you hand to the outside world (an install snippet, a callback URL)
  comes from `ctx.origins.public` in a handler, or `deps.origins` in a service
  (`{ app, public }`, no trailing slash), never from the browser's location:
  the app members use and the surface the outside reaches may be two
  different addresses.

### Tickets: a public route acting for a session

A public route has no session, yet some of them serve the logged-in browser:
a download the browser must open natively (no header to add), an OAuth
consent that comes back through the provider. The handler that starts the
gesture mints a ticket, `await ctx.secrecy.ticket(payload, { ttlSeconds })`
(two minutes by default), signed by the host and bound to the caller: their
session, this workspace, YOUR module. It hands the ticket to the browser (in
the download URL, as the OAuth `state`); the public route redeems it,
`await deps.secrecy.redeem(ticket)`, and gets `{ userId, workspaceId,
payload, cipher: { server, private } }` back: the caller's open cipher
always, the private one while their session is unlocked (`null` otherwise).
`null` as a whole means invalid, expired, or another module's ticket: answer
403 and stop. The module never sees a session id nor a key, and the route
stays sessionless for everyone who does not hold a ticket.

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

## Consuming a contract: `providers.get`

The same registry works the other way: a module that needs what another
feature owns reads the published contract through `deps.providers.get<T>(key)`
(service) or `ctx.providers.get<T>(key)` (handler), and degrades cleanly on
`undefined`. Who offers the key is none of your business: a module's service,
or the app itself for a feature still native (`DATABASE_BACKUP_PROVIDER` is
offered by DevEye while Databases is native; the day it becomes a module, its
service publishes the same key and nothing changes for you).

```ts
const databases = deps.providers.get<DatabaseBackupProvider>(DATABASE_BACKUP_PROVIDER);
if (!databases) throw new Error('Source indisponible.');   // a clean failure, not a crash
const access = await databases.openAccess(sourceId, workspaceId);
```

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
