# Background services

Declare `createService` on your server entry to run periodic work: polling an
external API, firing deadlines, refreshing a cache.

```ts
export const serverEntry: FeatureServer = {
    features,
    createService: (deps) =>
        deps.createTicker({
            intervalMs: 60_000,
            async tick() {
                for (const workspaceId of await deps.listWorkspaceIds()) {
                    const store = deps.storeFor(workspaceId);
                    ...
                }
            }
        })
};
```

`createTicker` is the app's standard loop: an interval, a reentrancy guard (a
slow tick is never overlapped by the next), errors logged and swallowed so one
bad tick never kills the service, and a `stop()` that resolves once the tick in
flight has finished. Use it instead of rolling your own; there is no cron, no
queue, and that is a deliberate choice of the host.

A service is `{ start, stop }`. `start()` may be async: DevEye awaits it during
boot, before the agent sockets open, and calls `stop()` on shutdown. An admin
can also put your feature in full-stop maintenance: DevEye then calls `stop()`
at runtime and, when the maintenance ends, `start()` again on the same object.
So `stop()` must resolve once the work in flight is finished or interrupted,
and leave nothing behind (a closed server kept, a subscription not released, a
result memoized once) that would break the second `start()`. The
service object is also what carries your `providers` (and, for DevEye's own
modules, `agentHooks`); to offer those without any periodic work, return
`{ start() {}, stop() {}, providers }`. To combine a ticker with them, keep the
ticker and delegate: `{ start: () => ticker.start(), stop: () => ticker.stop(), providers }`.

## The deps, and what is missing

`repo`, `listWorkspaceIds()`, `storeFor(workspaceId)`, `cipherFor(workspaceId)`,
`deveyeFor(workspaceId)` (notify only), `devicesFor(workspaceId)` (`list` and
`isOnline`, capability `'devices.read'`), `membersFor(workspaceId)` (`list`, the
members owner included, capability `'members.read'`: the names a public page
shows), `devices` (`find(id)` and `isOnline`, the whole fleet, same
capability), `accounts` (`find`, `findByEmail`, `list`, `search`, `all`,
capability `'accounts.read'`), `usage` (`of`, `ofMany`, capability
`'accounts.usage'`), `accountMail` (`configured`, `send`, `sendToAdmins`,
capability `'accounts.mail'`; all three in
[12-quotas-and-account](12-quotas-and-account.md#an-entry-in-the-user-menu)),
`quotaFor(workspaceId)` (the owner's plan against your quotas, for what gets
created outside any command) and `pauses` (`isPaused`, `paused`: your paused
`stock` items whatever the workspace; both in
[12-quotas-and-account](12-quotas-and-account.md#quotas)), `telemetry`
(reserved, capability `'telemetry.read'`), `live` (`changed(workspaceId,
topics?)`: your topic, or the topics named,
[09-live](09-live.md#writes-without-a-command); `publish(workspaceId, event,
payload)`, capability `'live.publish'`,
[09-live](09-live.md#pushing-your-own-frames-livepublish);
`accountChanged(userId)`), `audit(entry)` (recorded as the system; pass
`userId` when the work concerns one user's data), `keys` (raw key wrapping and
derivation, [below](#wrapping-key-material-of-your-own-depskeys)),
`objects(localDir)` (the host's object store, capability `'objects'`,
[04-storage-and-encryption](04-storage-and-encryption.md#files-the-object-store)),
`secrecy` (`redeem(ticket)`,
[below](#tickets-a-public-route-acting-for-a-session)), `origins`
(`{ app, public, site }`, the same a handler gets as `ctx.origins`), `domains`
(`findByHost`, `get`, `listVerified`: your feature's domains whatever the
workspace, [06-settings-panels](06-settings-panels.md#domains)), `providers`
(`get<T>(key)`, [below](#consuming-a-contract-providersget)), `agents`
(reserved, [below](#the-agent-fleet-reserved)), `access`
([below](#acting-on-a-members-behalf-depsaccess)), `createTicker`, `logger`.

No user, no session, no `'private'` tier: the sessionless store cannot write
private values (the type refuses), and reading one throws `locked`. If your
scheduler needs a value, store it with the default `'server'` encryption. This
is the platform's encryption promise, not a missing feature.

## Acting on a member's behalf: `deps.access`

Work a member set up keeps running long after the command that created it (a
nightly backup of their machine). Record who set it up, and ask on every run
whether they still may, without a session:

```ts
const may = await deps.access.feature(workspaceId, authorUserId, {
    level: 'write',
    extras: ['deviceFolders'],
    itemId: String(job.id)
});
if (!may.ok) throw new Error(`Its author can no longer run it (${may.reason}).`);
const files = await deps.access.device(workspaceId, authorUserId, deviceId, ['files']);
```

The rules of a command apply: account not suspended, membership, role, the
item's override, permissions. `feature` answers for your own feature only;
`device` for the Devices permissions on one device (capability
`'devices.read'`). Nothing is cached: a right withdrawn stops the next run.

## Discipline that keeps hosts happy

- Bound each tick: batch, or bail early when there is nothing to do.
- Mark work as done **before** long side effects when replaying would be worse
  than skipping (a crashed tick must not re-send yesterday's alerts).
- Log with `deps.logger` and let the ticker swallow: a service that throws its
  way out of existence takes your feature's freshness with it.
- Keep `warn` and `error` for what the operator must fix. A member's host that
  does not answer or a token they revoked is theirs: `logFailure` writes it as
  `info` with `cause: 'user'` (see the [reference](./REFERENCE.md)).

## Environment variables: `env`

A module reads its own environment variables, never through the host, and
each one has a default that works: an install without a single line of yours
must run. Declare them once as data and read them from that declaration:

```ts
// src/server/env.ts
import { defineModuleEnv, readModuleEnv } from '@deveye/types/sdk/server';

export const MY_ENV = defineModuleEnv({
    MY_TICK_SECONDS: { kind: 'int', default: 60 },
    MY_STORAGE_DIR: { kind: 'path', default: '/data/my-feature' },
    MY_SITE_URL: { kind: 'url', default: 'https://example.com' },
    MY_API_KEY: { kind: 'secret', optional: true }
});

export const env = readModuleEnv(MY_ENV).values; // { MY_TICK_SECONDS: number, ... }
```

Then hand the same spec to the host, `env: MY_ENV` on your `serverEntry`. At
boot the host reads it again and writes one warning per module naming every
variable left to its default, with the value applied. A default that guesses
at the operator's world (a site address, a storage path) is then read in the
boot log instead of discovered in production.

- Kinds: `int` (`min`, 1 when omitted), `text`, `path`, `url` (http(s)),
  `flag` (`true`/`1`, `false`/`0`), `choice` (`choices`), `secret` (never
  printed, empty by default).
- A variable set to an empty string counts as set: it falls back to its
  default without a word, except a `url`, where empty means "none".
- A value that cannot be read as its kind falls back and is reported as
  invalid.
- `optional` silences a variable an install may well not use (an OAuth
  client, a certificate supplied by the operator).
- A malformed spec stops the host at boot.

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
keep it wrapped under the server key in a table of yours, and unwrap it at
`start()`:

```ts
import { randomBytes } from 'node:crypto';

// migrations/002_key.sql: CREATE TABLE ft_myfeature_key (id TINYINT NOT NULL
// PRIMARY KEY, sealed TEXT NOT NULL) ... COLLATE utf8mb4_general_ci
export const KEY_CONTEXT = 'ft_myfeature_key:sealed';

let sealed = await deps.repo.sealedKey(); // SELECT sealed FROM ft_myfeature_key WHERE id = 1
if (sealed === null) {
    // INSERT IGNORE ... (1, ?): two processes booting together keep the first one.
    await deps.repo.insertSealedKey(deps.keys.sealBytes(randomBytes(32), KEY_CONTEXT));
    sealed = await deps.repo.sealedKey();
}
const raw = sealed === null ? null : deps.keys.openBytes(sealed, KEY_CONTEXT);
if (raw === null) throw new Error('blob key cannot be unwrapped: server keys changed?');
```

Then declare the column on your server entry, so a change of the server key
(`CRYPT_KEY_A` / `CRYPT_KEY_B`) re-wraps it:

```ts
sealed: [{ table: 'ft_myfeature_key', column: 'sealed', id: 'id', context: () => KEY_CONTEXT }],
accountExport: {
    tables: { ft_myfeature_key: { skip: 'The key that encrypts your files never leaves the server.' } }
}
```

- `sealBytes(plain: Uint8Array, context?: string): string` seals under the
  SERVER key, in the app's own wire format; `openBytes(sealed: string,
context?: string): Uint8Array | null` reverses it, and answers `null` when
  the blob was tampered with, the context differs or the server keys changed.
  `context` binds the blob to the row it belongs to (authenticated, not
  stored): pass the same string both ways, `<table>:<column>:<id>`, so a blob
  copied onto another row does not open. The host seals under a sub-key of its
  own for each module: a blob sealed by one module never opens in another.
  Treat `null` as fatal for that key and say so loudly: generating a fresh one
  would silently make everything sealed under the old one unreadable.
- `sealed` on your server entry lists every column holding such blobs:
  `{ table, column, id, match?, context? }`, `id` naming the column that
  identifies a row on its own, `match` narrowing to the rows that hold a blob
  (`{ kind: 'root' }`), `context` returning what you passed to `sealBytes` for
  that row. The host re-wraps exactly these columns when the server key
  changes, and refuses to boot on a table missing from your
  `accountExport.tables`. A column left out turns unreadable at the first
  rotation; so does a blob kept in the store, which is the host's table and
  never declared. Check it in tests with `sealedColumnsProblem(serverEntry)`.
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
- `bodyLimit` caps the body in bytes (a megabyte by default): size it on the
  biggest legitimate call, every byte of it is parsed before your schema sees
  anything. `rawBody: true` also hands the handler the undecoded body, what a
  webhook signature is computed over (JSON bodies only; see
  [12-quotas-and-account](12-quotas-and-account.md#webhooks)).
- `exposure` picks the listeners: `'everywhere'` (default) serves the route
  on the app and on the public surface, for what the outside world calls (a
  beacon); `'app'` serves it on the app's own origin only, for what the
  logged-in browser fetches without a session header (a ticketed download,
  an OAuth callback that lands back in the app).
- `req` is `{ headers, body, query, params, host, ip }`, plus `rawBody` on a
  route that asked for it: no user, no workspace, no `'private'` tier. `body`
  is the JSON body already decoded (`undefined` when absent or unreadable),
  `query` the decoded query string, `params` the path parameters; all three
  are `unknown`, read them through a schema. `host` is the request's host as
  the host normalised it (`Host`, or `X-Forwarded-Host` behind a trusted
  proxy, port included): untrusted data, which proves nothing and only picks
  among what the database already verified. Route the request from what it
  carries (a key in the body) to the workspace it belongs to, through your
  repo.
- The reply surface is minimal and chainable: `header(name, value)`,
  `code(status)`, `send(payload?)`.
- What you hand to the outside world (an install snippet, a callback URL)
  comes from `ctx.origins.public` in a handler, or `deps.origins` in a service
  (`{ app, public, site }`, no trailing slash; `site` is the marketing site
  where the legal pages live, `null` when the host has none), never from the
  browser's location: the app members use and the surface the outside reaches
  may be two different addresses.
- `/` is the host's, refused at boot. A page served at the root of a
  customer's domain goes through `domainRoot(req, reply, domain)` on the
  service ([cookbook](11-cookbook.md#serve-something-on-the-customers-own-domain)).
- A page you render sets its own `content-security-policy`: the public
  surface answers `default-src 'none'` otherwise, which blocks an inline
  `<style>`. A script is best served from a route of yours
  (`script-src 'self'`) rather than inlined.

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
import { CLOUDSYNC_BACKUP_PROVIDER, type TreeBackupProvider } from '@deveye/types/sdk';

createService(deps) {
    const backup: TreeBackupProvider = { list, find, entries, open };
    return { start() {}, stop() {}, providers: { [CLOUDSYNC_BACKUP_PROVIDER]: backup } };
}
```

App-side, `moduleProvider(key)` walks the installed modules' services in
installation order and returns the first value found under that key, or
`undefined`; the caller then degrades cleanly (Backup fails the run with a
clean "module not installed" error and hides that source kind in its UI). What
it means for you:

- You can only fill a contract the host already knows: a key nothing looks up
  is inert. The published contracts are listed in
  [REFERENCE](REFERENCE.md#server-contracts-sdkprovidersts). Proposing a new
  one is a change to `@deveye/types`, hence a pull request against DevEye. The
  client twin (`FeatureClient.providers`, `UPTIME_CLIENT_PROVIDER`) lets an app
  screen compose a module's components the same way ([05-client](05-client.md#offering-components-to-the-host-providers)).
- Providers live on the service: a module that offers one declares
  `createService`, even with no ticker.
- The app calls a provider without a session, like every service: only
  `'server'`-tier data can serve it.

## Consuming a contract: `providers.get`

The same registry works the other way: a module that needs what another
feature owns reads the published contract through `deps.providers.get<T>(key)`
(service) or `ctx.providers.get<T>(key)` (handler), and degrades cleanly on
`undefined`. Who offers the key is none of your business: a key comes from the
service of whichever module fills it, DevEye's own features being modules on
the same contract.

```ts
const databases = deps.providers.get<DatabaseBackupProvider>(DATABASE_BACKUP_PROVIDER);
if (!databases) throw new Error('Source indisponible.'); // a clean failure, not a crash
const access = await databases.openAccess(sourceId, workspaceId);
```

## The agent fleet (reserved)

DevEye installs an agent on the workspace's devices, and one of DevEye's own
modules (CloudSync, the folder sync) drives it. The surface is in the SDK
types so that such a module can be built out of tree, and it is reserved to
native-id modules: `validateManifest` refuses
`nativeCapabilities: ['agents']` on an `x-` id. The agent protocol is app
infrastructure, the contract between DevEye and its own agent binary; the
payload types the facade takes come from `@deveye/types` itself, outside the
`sdk*` entries whose stability the SDK promises, so a third-party module
cannot depend on them. What a module may know about devices is
`'devices.read'`, above. For the record, what the capability opens:

- `ctx.deveye.agents` and `deps.agents` (`AgentsFacade`): `isOnline`; the two
  orders of a device's lifecycle (`requestDestroy`, `disconnectAgent`);
  `requestScan` (an immediate security scan); `pushConfig` (the device's
  collection config, recomposed by the app from the device row and the
  modules' contributions) and `metricIntervals`; `servedManifest` (the agent
  binaries the app serves); ten outbound `requestSync*` calls that answer
  `false` when the agent is offline (frame dropped, never queued), and
  `publishSyncProgress` / `publishSyncState`, the fan-out to the browsers
  subscribed to a share; the file orders of the explorer (`requestFilesMutate`,
  `requestFilesUpload`, `awaitFilesOp`, `cancelFilesOp`); `dockerRun` and
  `dockerInventory`; `archiveFolder` (a folder's `.tar.gz`, pulled at the
  consumer's pace) and `openTcp` (a connection the device opens on its side);
  `buffered` for backpressure.
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
  `onSyncAck`, `onSyncBusy`, `onSyncOpResult`, `onSyncDeviceKey` (the agent's
  X25519 public key, sent after every `sync.config` it receives). Every hook
  is optional; an absent one is a no-op. The app aggregates the hooks of every module that
  declares `'agents'` and calls each in isolation: a throw or a rejection in
  one module is logged by the host (`{ err, module, hook }`) and reaches
  neither the other modules nor the socket layer. You do not need to catch to
  be safe, but a failed hook loses that frame for your module. Hooks may fire
  before your `start()` has completed: drop the event quietly, the agent
  resends or reconciles. `deviceId` is the socket's authenticated identity;
  the copy inside the payload is not trusted.
