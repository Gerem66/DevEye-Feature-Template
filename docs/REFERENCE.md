# API reference

The surface, type by type. Sources of truth: `@deveye/types/sdk` (shared),
`@deveye/types/sdk/server`, `@deveye/types/sdk/client`, `@deveye/types/sdk/testing`,
and the app-provided `deveye-sdk-client` module.

## `@deveye/types/sdk`

- `FeatureManifest`: the declaration; see [02-manifest](02-manifest.md).
- `ManifestCommand`: `{ command, input, output }`, zod both ways.
- `ExtraPermissionSpec`: `toggle` or `choice` (2..5 options, least-privileged
  `default`, explicit `ownerValue`). `MAX_EXTRA_PERMISSIONS = 10`.
- `NativeCapability`: `'notify' | 'mail.accounts' | 'members.read' |
'workspaces.read' | 'devices.read' | 'telemetry.read' | 'agents' |
'routes.public' | 'live.publish'`; `'telemetry.read'` and `'agents'` are
  reserved to native-id modules (`validateManifest` refuses them on an `x-`
  id).
  `'workspaces.read'` lists every workspace of this DevEye and refuses anyone
  but a global administrator. `'routes.public'` opens sessionless HTTP routes
  (`FeatureService.publicRoutes`, see
  [10-background-services](10-background-services.md#public-http-routes-publicroutes)).
  `'live.publish'` pushes frames of your own to the workspace's connected
  members (`ctx.live.publish`, `deps.live.publish`, see
  [09-live](09-live.md#pushing-your-own-frames-livepublish)).
- `CrossTopicInvalidation`: `{ topic, keys }`, the element of the manifest's
  `alsoInvalidatedBy` (a native topic, a subset of `resources`; at most 4).
- `FeatureManifest.topics`: `{ id, keys }[]`, secondary live topics of your
  own (`id` prefixed by your feature id and different from it, `keys` a
  subset of `resources`), beaten by `mutates: ['<topic>']` or
  `live.changed(ws, ['<topic>'])`; see
  [02-manifest](02-manifest.md#secondary-topics-of-your-own).
- `SettingsTab` (`'general' | 'sources' | 'notifications' | 'permissions' | 'sync' | 'encryption'`;
  `'sync'` and `'encryption'` are item-scope tabs), `CustomTabRef`
  (`{ id, label, icon?, requiresWrite? }`; `requiresWrite` drops the tab
  without write access, for one holding nothing but gestures),
  `FeatureCategory`, `FeatureLink` (`{ to, what }`, `MAX_FEATURE_LINKS = 6`).
- `validateManifest(manifest)`: throws with a named reason.
- Ids: `externalFeatureIdSchema` (`/^x-[a-z][a-z0-9]{1,24}$/`), `featureIdSchema`,
  `isExternalFeatureId`, types `ExternalFeatureId`, `FeatureId`.
- Provider contracts: a named key a module fills so another module, or the app
  itself, can use what it owns without importing it. Server side under
  `FeatureService.providers`, read with `ctx.providers.get` /
  `deps.providers.get`; client side under `FeatureClient.providers`, read with
  `moduleClientProvider`. Absent module, `undefined`, degrade cleanly. See
  [10-background-services](10-background-services.md#offering-a-contract-to-the-host-providers).

### Server contracts (`sdk/providers.ts`)

| Key                      | Contract                      | What it hands over                                                                                                                               |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'cloudsync.backup'`     | `CloudSyncBackupProvider`     | `findShare`, `listShares`, `statsByShare`, `listPresentFiles`, `openBlob`; rows `SyncBackupShare`, `SyncBackupStats`, `SyncBackupFile`           |
| `'database.backup'`      | `DatabaseBackupProvider`      | `listDatabases`, `findDatabase`, `openAccess`; `DatabaseBackupCandidate`, `DatabaseBackupAccess` (an open access, `close()` releases the tunnel) |
| `'mail.transport'`       | `MailTransportProvider`       | `listSenders`, `isReady`, `send`: how an email alert leaves; `MailSender`                                                                        |
| `'sentinel.agentConfig'` | `SentinelAgentConfigProvider` | `configFor(deviceId)`: what Sentinel adds to the config pushed to an agent; `SentinelAgentConfig`                                                |
| `'projects.usage'`       | `ProjectsUsageProvider`       | `usageOf`, `countByItem` (which projects link an item of yours), `recordEvent` (one timeline line), `applyVersion`; `ProjectUsage`               |
| `'uptime.items'`         | `UptimeItemsProvider`         | `exists`, `labelOf`                                                                                                                              |
| `'git.items'`            | `GitItemsProvider`            | `exists`, `labelOf`                                                                                                                              |
| `'deploy.items'`         | `DeployItemsProvider`         | `exists`, `labelOf`                                                                                                                              |
| `'database.items'`       | `DatabaseItemsProvider`       | `exists`, `labelOf`                                                                                                                              |
| `'audience.items'`       | `AudienceItemsProvider`       | `exists`, `labelOf`                                                                                                                              |

The five `*.items` contracts share one shape: `exists(itemId, workspaceId)`,
asked before linking an id a client sent: true for an item visible from that
workspace, its home or one it is projected into (an id visible nowhere here
can neither be linked nor leak its existence); and `labelOf(itemId,
workspaceId)`, the item's name, resolved by the provider under its home's
open cipher, `null` when it is gone. Projects consumes all five and publishes
`'projects.usage'` in return; the app calls its `detach` whenever an item
stops being visible from a workspace (deleted, moved, projection withdrawn).

### Client contracts (`sdk/client.ts`)

| Key                 | Contract                 | What it hands over                                                                                                                                               |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'devices.client'`  | `DevicesClientProvider`  | `useDevices()`, `refreshDevices()`, `resetDevices()`, `DevicePanel`, `DeviceWidget`, over `SdkDeviceSummary` rows (`id`, `name`, `online`, `status`, `platform`) |
| `'uptime.client'`   | `UptimeClientProvider`   | `listServices`, `useServiceHistory`, `StatusBars`, `Ratios`, `ServiceDialog`; `UptimeLinkedService`, `UptimeHistoryPoint`                                        |
| `'mail.client'`     | `MailClientProvider`     | `listSenders()` (the ready senders an email channel picks from) and `AccountDialog`, the feature's own account form                                              |
| `'git.client'`      | `GitClientProvider`      | `listRepos`, `LinkedRepo` (the whole linked-item block, rendered inside a project's tab), `RepoDialog`; `GitLinkedCandidate`                                     |
| `'deploy.client'`   | `DeployClientProvider`   | `listTargets`, `LinkedTarget`, `TargetDialog`; `DeployLinkedCandidate`                                                                                           |
| `'database.client'` | `DatabaseClientProvider` | `listDatabases`, `LinkedDatabase`, `DatabaseDialog`; `DatabaseLinkedCandidate`                                                                                   |
| `'audience.client'` | `AudienceClientProvider` | `listSites`, `LinkedSite`, `SiteDialog`; `AudienceLinkedCandidate`                                                                                               |

The four `*.client` contracts of linkable features share one shape too: the
workspace's items to pick from, the block that renders one in full inside a
project's tab, and the feature's own creation dialog, so a project never
reimplements a reduced form of it.

## `@deveye/types/sdk/server`

- `isSafePublicUrl(url)` / `isPublicIp(address)`: the SSRF guard, as plain
  functions. Call the first on any URL a member typed before your server
  fetches it, clones it or resolves it: it accepts only public http(s), and
  refuses `localhost`, private and link-local ranges, CGNAT, `.local` /
  `.internal` suffixes, and every other protocol (a git `ext::` runs a command,
  a `file://` reads the server's disk). It does NOT resolve a hostname: DNS
  would change between the check and the connection anyway, so bound the
  address you finally connect to if that matters to you.
- `FeatureServer`: your `./server` export: `features`, optional `createRepo(q)`,
  `migrationsDir`, `createService(deps)`, `items` (`FeatureItemsEntry`:
  `homeOf(repo, itemId, workspaceId)`, `labelOf(repo, cipher, itemId,
workspaceId)`, optional `shareable(repo, itemId, workspaceId)` answering
  `false` for an item its tier forbids to project, required by a `shareTier`
  other than `'never'`; optional `move` (`FeatureItemsMove`: `plan(ctx)`
  returning `SdkMovePlan` `{ blockers, drops, rows }` from a read-only `q`, and
  `apply(ctx)` given a TRANSACTIONAL `q`, your `repo` for reads only, and the
  two workspaces' open ciphers) which lets an item change workspace. Omit
  `move` and your items simply cannot be moved, which is the safe default and a
  valid answer when an item depends on a workspace source that cannot follow
  it). A module
  with migrations also ships `src/server/migrations/`' destructive mirror
  `src/server/uninstall.sql` (`DROP TABLE IF EXISTS` on its own `ft_<slug>_`
  tables only; see 04-storage-and-encryption).
- `MovableCell` + `resealCells(q, cells, ownerId, ciphers)` +
  `countMovableCells(q, cells, ownerId)`: the two halves of a `move`. Declare
  one cell per encrypted column hanging off your item (`ownerScope` for a row
  that hangs off it indirectly, a literal subquery of yours taking the item id).
  `resealCells` reads and converts EVERYTHING before its first write and throws
  before writing anything if one cell resists: half a converted tree is
  unreadable forever and nothing can detect it, one encrypted blob being
  indistinguishable from another. The cell list is held BY HAND: revisit it
  whenever you add an encrypted column.
- `SdkFeatureDefinition` / `defineSdkFeature`: one command:
  `access?: { level?: 'read' | 'write'; extras?: string[]; admin?: boolean }`
  (`admin: true` requires a global administrator on top of the feature check:
  fleet management),
  `mutates?: boolean | readonly string[]` (`true` beats your feature's own
  topic, its id; a list names the topics to beat instead: your id, one of
  your `manifest.topics`, or another feature's topic whose screens mirror
  this data; an unknown topic is refused at boot), `handler(ctx, input)`.
- `SdkFeatureContext<Repo>`: see [03-server-handlers](03-server-handlers.md).
  Carries `isAdmin` (the caller is a global administrator: what a fleet-wide
  view keys on; a command that must require it declares `access: { admin:
true }`), `transport: SdkSocketTransport` (capability `'agents'`; every method
  throws `forbidden` otherwise), `secrecy: SdkSecrecy` (`isUnlocked()`, and
  `ticket(payload, { ttlSeconds? })`: a short-lived ticket signed by the host
  and bound to the caller, their session, this workspace and your module, that
  a public route of your service redeems with `deps.secrecy.redeem`; two
  minutes by default), `keys: SdkServerKeys` (the same object a service gets),
  `live: SdkContextLive` (`publish(event, payload)`: capability
  `'live.publish'`, the frame goes to the members of THIS workspace who hold
  `read` on your feature; `event` must start with your feature id),
  `items: SdkItems` (`restrictions()`, `assert(itemId, level?)`,
  `forget(itemId)`, all on text ids: pass `String(row.id)` from a row-keyed
  table), `sharing: SdkSharing` (`scope()` returning an `SdkShareScope`:
  `foreignIds`, `homeOf`, `cipherFor`, `orderOf` — the rank a projected item
  holds in the active workspace — plus `setOrder(itemId, order)`) and
  `providers: SdkProviders` (`get<T>(key)`: a published contract, whoever
  offers it; `undefined` when nobody does) and `origins: { app, public }`
  (where DevEye lives, as URLs without a trailing slash: `app` is the origin
  members use, `public` the one reachable without the VPN when the host has a
  public surface, else the same; for what a module hands to the outside
  world, an install snippet or a callback URL, never derived from the
  browser's location).
- `FeatureStore`: `put/putJson/get/getJson/remove/keys`; `putJson`/`getJson`
  take a zod schema. `StorageEncryption = 'server' | 'private' | 'none'`.
- `SessionlessFeatureStore`: the service variant; `'private'` unrepresentable.
- `SdkCipher`: `encrypt`, `decrypt` (throws), `tryDecrypt` (null).
- `SdkQueryable`: `query<T>(sql, params): Promise<T[]>`,
  `execute(sql, params): Promise<{ affectedRows, insertId }>`.
- `DevEyeFacade`: `notify.hasRoute(itemId?)`, `notify.send(alert, { itemId?,
except? })` (an `SdkAlert`: `subject`, `body`, `payload?`, `embeds?`;
  `except` skips channel ids a live message already concluded on),
  `notify.liveChannels({ itemId? })` (the routed `SdkLiveChannel`s able to
  carry a live message), `notify.postLive(channelId, message, messageId?)`
  (posts or edits an `SdkRichMessage` `{ content?, embeds? }`; resolves the
  id to keep for the next edit, `null` when the channel refused: stop there),
  `mail.listAccounts`, `members.list`, `workspaces.list` (capability
  `'workspaces.read'` and a global administrator as caller: every workspace,
  `{ id, name, kind, ownerUserId }`),
  `devices.authorize/list/isOnline`, `telemetry` (an `SdkTelemetry`:
  `snapshot(deviceId, ts)` returning an `SdkTelemetrySnapshot` or null,
  `pinInstant(deviceId, ts)`), `agents` (an `AgentsFacade`); each gated by
  the manifest's `nativeCapabilities`.
- `SdkDevice`: `{ id, name, online, status, ownerUserId, workspaceId,
metricIntervalSeconds, report }`, what the devices facade reveals.
- `FeatureService`: `start` (may be async; awaited at boot, before the agent
  sockets open), `stop`, `agentHooks?: FeatureAgentHooks`,
  `providers?: Readonly<Record<string, unknown>>` (keyed by a published
  provider key), `publicRoutes?(app: SdkPublicApp)` (capability
  `'routes.public'`; called once per listener the host exposes, register the
  same routes each time).
- `SdkPublicApp`: `get(path, opts, handler)` / `post(path, opts, handler)`;
  paths are absolute (`/t.js`, `/api/t/b`) and a path the host already serves
  is refused at boot. `SdkPublicRouteOptions`: `rateLimit?: { max,
timeWindow }` (a per-address ceiling on top of the host's own),
  `exposure?: 'everywhere' | 'app'` (`'everywhere'`, the default, mounts the
  route on the app and the public surface; `'app'` on the app's own origin
  only, for a ticketed download or an OAuth callback).
  `SdkPublicHandler(req: SdkPublicRequest, reply: SdkPublicReply)`: the request
  is `{ headers, body (JSON, already decoded, `undefined` when absent or
unreadable), ip }`, nothing of a session; the reply is the chainable
  `header(name, value)`, `code(status)`, `send(payload?)`.
- `FeatureServiceDeps<Repo>`: `repo`, `listWorkspaceIds`, `storeFor`,
  `cipherFor` (open tier), `deveyeFor` (notify only), `devicesFor` (`list`,
  `isOnline`), `devices` (`SdkFleetDevices`: `find`, `isOnline`),
  `telemetry`, `live` (`SdkLive`: `changed(workspaceId, topics?)`: your
  topic by default, or the topics named, your own secondary ones or another
  feature's; `publish(workspaceId, event, payload)`: capability
  `'live.publish'`, one frame to that workspace's connected readers), `audit` (system
  source, optional `userId`), `agents`, `keys`, `secrecy`
  (`redeem(ticket)`: an `SdkRedeemedTicket` `{ userId, workspaceId, payload,
cipher: { server, private } }`, the private cipher `null` while the caller's
  session is sealed; `null` as a whole for a ticket invalid, expired or minted
  by another module), `origins` (`{ app, public }`, as on the context),
  `providers` (`SdkProviders`, same as on the context),
  `createTicker({ intervalMs, tick })`, `logger`.
- `SdkServerKeys`: `sealBytes(Uint8Array): string`,
  `openBytes(string): Uint8Array | null` (null: tampered, or server keys
  changed), `derive(salt, info, length): Uint8Array` (HKDF-SHA256 over the
  server key, never stored: for material that must survive the database).
  Server key, module-owned key material only, never user data.
- Reserved to native-id modules (capability `'agents'`): `AgentsFacade`
  (`isOnline`, `requestScan`, `pushConfig`; the three orders a device's
  lifecycle gives the hub, `requestDestroy` (the agent uninstalls itself),
  `disconnectAgent` (its socket closes now), `resetAgentSession` (the hub
  forgets what it remembered of it), each `false` when the agent is offline;
  `requestSyncConfig`,
  `requestSyncScan`, `requestSyncPush`,
  `requestSyncApplyChunk`, `requestSyncApplyStart`, `requestSyncApplyDir`,
  `requestSyncApplyLocal`, `requestSyncMove`, `requestSyncDelete`, each
  `false` when the agent is offline; `publishSyncProgress`,
  `publishSyncState`; the file orders of the explorer: `requestFilesMutate`,
  `requestFilesUpload`, `awaitFilesOp(opId, timeoutMs)`, `cancelFilesOp`,
  `buffered(deviceId)` for backpressure), `SdkSocketTransport` (`subscribeSync`,
  `unsubscribeSync`, `sendSyncChunk` returning the send-buffer size,
  `syncChunkBuffered`), `FeatureAgentHooks` (`onAgentConnect`,
  `onAgentOffline`, `onReport`, `onMetricsBatch`, `onIntegrity`,
  `onAuthEvents`, `onSyncChanged`, `onSyncIndex`, `onSyncChunk`,
  `onSyncAck`, `onSyncOpResult`, all optional). Their payload types come from
  `@deveye/types` itself, outside the SDK's stability promise.
- `FeatureError(code, message, details?)`: codes `validation`, `forbidden`,
  `not_found`, `conflict`, `locked`, `internal`.

## `@deveye/types/sdk/client`

- `FeatureClient`: your `./client` export: `Widget` (no props),
  `Full({ closeFeature })`, `settingsPanels?` (one panel per manifest tab
  that needs one: `general`, `sources`, `sync`, `encryption`, custom ids),
  `TopbarWidget?` (no props: it may only show what your own commands return,
  which the server authorizes against the caller's grants),
  `cacheDurationMinutes?`, `preload?`, `holdSecrecy?`, `providers?` (named
  contracts offered to the host's screens; `UptimeClientProvider` with
  `UptimeLinkedService`, `UptimeHistoryPoint`, `UptimeHistoryResolution`,
  `MailClientProvider` with `listSenders` and `AccountDialog`, and the four
  Projects composes, `GitClientProvider`, `DeployClientProvider`,
  `DatabaseClientProvider`, `AudienceClientProvider`, each a `list...`, a
  `Linked...` block rendered in full inside a project's tab, and the
  feature's own dialog, with their `...LinkedCandidate` rows, are the ones
  published).
- `SettingsPanelProps`: `{ scope, canWrite, close, gone }`; `close()`
  dismisses the settings dialog and nothing more; `gone()` says the item
  being configured no longer exists here (deleted, moved), closes the
  dialog and makes the view that opened it leave the item; `SdkSettingsScope`
  is `{ kind: 'feature' }` or `{ kind: 'item', itemId, itemLabel, shareable? }`
  (`shareable: false` hides the Sharing tab for an item the server would
  refuse to project). The item id is text, whatever key your table uses: a
  row-keyed feature reads it back with `Number(...)`.
- `DevicesClientProvider` and `SdkDeviceSummary`: the Devices module's
  client contract (see `DEVICES_CLIENT_PROVIDER` above).

## `@deveye/types/sdk/testing`

- `createTestContext(overrides?)`: in-memory `SdkFeatureContext` plus
  `recorded` (notifications, liveMessages, audits, agentRequests,
  pinnedInstants, livePublishes),
  `forgotten` (the item ids passed to `items.forget`) and an inspectable
  `store.rows`. Its facade answers by default: `devices.authorize` resolves
  `testDevice({ id })` (active, online, unreported), `devices.list` is empty,
  `devices.isOnline` is true, `telemetry.snapshot` is null, `agents` records
  every request and answers true, `transport` is a no-op, `secrecy` is
  unlocked, `items.restrictions()` is empty and `sharing.scope()` has no
  projection. Overrides: `repo`, `userId`, `workspaceId`, `kind`, `isOwner`,
  `isAdmin`, `canWrite`, `extras`, `manifest`, `hasRoute`, `notifyAccepted`
  (what `notify.send` resolves; recorded either way), `liveChannels`,
  `devices`, `snapshots`, `workspaces` (what `workspaces.list()` answers),
  `origins`, `providers`, `deveye` (a partial facade), `unlocked` (false also
  seals the `'private'` cipher: `decrypt` throws `locked`, `tryDecrypt`
  answers null, like the app's guarded tier in a locked session),
  `itemRestrictions`, `shares`.
- `createTestServiceDeps(overrides?)`: the service twin; `recorded` adds
  `tickers`, `liveChanges` and `liveTopicChanges` (which topics a
  `live.changed(ws, [...])` beat), and shares `livePublishes` with the
  context harness. Overrides: `repo`, `workspaceIds`,
  `devices`, `hasRoute`, `notifyAccepted`, `liveChannels`, `origins`,
  `snapshots`, `providers`.
- `testDevice(over)`: an `SdkDevice` with sensible defaults.

## `deveye-sdk-client` (provided by the app)

The list below mirrors `@deveye/types/src/sdk/client-ambient.d.ts`, the typed
portrait of the barrel that DevEye's own CI checks against the real one; it is
maintained separately from the server sections above, and that file is the
authority when the two differ.

- UI kit: `Button`, `TextInput`, `SelectInput`, `Checkbox`, `Switch`,
  `SegmentedControl`, `Dialog`, `DialogCancelButton`, `Popup` / `OpenPopup` /
  `ClosePopup` (the imperative dialog layer), `openInfo`, `StatusBadge`,
  `ConfirmDialog`, `FeatureSettingsButton` (`scope`, `initialSection?`,
  `onOpenChange?`, `onGone?`: the item was deleted or moved from inside the
  settings, the detail view leaves it), `settingsStyles` (the canonical
  settings rows), `ReadOnlyNotice` (the one shape of a read-only refusal in a
  settings panel), `CountWidget` + `useWorkspaceCount` (+ `CountState`),
  `useDragReorder`, `Avatar` (a member's identity dot; `user` may be
  `undefined`), `userColorVar(color)` (the CSS variable of an account colour,
  the one the live presence paints with).
- `useDialogClose()`: the enclosing `Dialog`'s guarded close (unsaved-changes
  prompt included).
- `useDialogSubmit(fn | null)`: `fn` becomes the enclosing `Dialog`'s primary
  action (Enter triggers it); `null` clears it.
- `useDismissLayer(open, onEscape | null)`: registers the topmost dismissible
  layer while `open`, so Escape closes overlays innermost first; `null`
  absorbs Escape without closing.
- Data: `useResource(key, load, fallback, deps?)`, `invalidate(...keys)`,
  `useResourceVersion(key)`, `onResourceChange(key, cb)`,
  `humanizeError(e, fallback)`, `WsError` (the class a command rejects with:
  `code`, `message`, `details`; `instanceof` works), `featureApi(manifest)`
  (typed `send`, with an optional `{ timeoutMs }` for commands that query a
  slow third party), `commandsApi(commands)` (the same over any list of
  contracts: `commandsApi(agentCommands)`, the native agent transport, with
  `agentCommands` from `@deveye/types`).
- HTTP, for the routes that serve binaries: `httpGet(path, schema)` (session
  cookie, one replay after an access refresh), `ensureFreshAccess()` (renew
  the access cookie before a raw `fetch`); `APP_VERSION` (the DevEye version
  the interface was built from).
- Password-based encryption: `useSecrecy()` (live lock state), `withSecrecy(run)`
  (retry once after the unlock prompt on a `locked` error),
  `ensureSecrecyUnlocked()` (explicit unlock gesture), `touchSecrecy()` (keep
  the unlocked session alive during a long operation the user is watching),
  `UnlockCancelledError` (the rejection of the two previous ones when the
  prompt is dismissed: a cancel, not a failure). Needed as soon as one of your
  commands reads `'private'` data.
- Live: `useLiveSegment`, `useLiveItemTarget`, `useLiveOutline(s)` (+
  `LiveOutlineProps`), `useTypers`, `useTypingSignal`.
- Push events: `onServerEvent(event, schema, cb)` (typed server-push
  subscription), `onSocketOpen(cb)` (the resubscribe-on-reconnect primitive),
  `isSocketOpen()`.
- Shared helpers: `formatBytesFr`, `DeviceFolderPicker`, `useDevices()` (the
  workspace's devices through the Devices module's provider, `{ devices,
loading, error }`; empty, loaded and error-free without the module),
  `acquireMetrics(deviceId)` (a counted live metrics subscription; call the
  returned release), `joinPath(base, name)` and `isWinPath(p)` (device paths
  as the agent reports them).
- Rights and workspace: `useWorkspacePermissions()` (incl. `canExtra`,
  `extraValue`), `useActiveWorkspace()` (`.kind`), `useWorkspaceMembers()`
  (the active workspace's members as the session lists them, empty before it
  answers), `useCurrentUser()` (the signed-in user, `null` before the session
  answers), `useFeatureLifecycle`.
- Composing another module: `moduleClientProvider<T>(key)` (the client
  contract another module offers under a key of `@deveye/types/sdk`,
  `undefined` when that module is not installed: degrade, never assume).
- Images: `fileToSquareDataUrl(file, { size, maxLength })` (a picked image
  resized to a square data URL under `maxLength` characters; throws a
  readable message), with `ACCEPTED_TYPES` and `MAX_INPUT_BYTES`, the
  inputs it accepts.
- Types: `InputChange` (the change event of a text input), `LiveSegmentKind`
  (`'view' | 'l1' | 'l2' | 'l3' | 'l4'`), `SecrecyState` (what `useSecrecy()`
  answers), `ConfirmRequest` (what a `ConfirmDialog` is opened with),
  `CountState` (what `useWorkspaceCount` answers), `ExternalResourceKey` (a
  resource key of an `x-` module), `LiveOutlineProps`.
- Host navigation and frame: `openFeature(feature, itemId?)` (open another
  feature of the active workspace, on one of its items), `useRequestPopupWidth(px | null)`
  (ask the feature popup for a wider frame while mounted), `useStickyOffset<T>()`
  (two sticky bands one under the other: `{ ref, style }`, the ref measures
  the top band, the style hands a common ancestor the `--sticky-head`
  variable the lower band offsets itself by; `StickyOffset<T>` is its type).

Anything not listed here is DevEye internal and may change without notice.
