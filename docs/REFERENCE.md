# API reference

The surface, type by type. Sources of truth: `@deveye/types/sdk` (shared),
`@deveye/types/sdk/server`, `@deveye/types/sdk/client`, `@deveye/types/sdk/testing`,
and the app-provided `deveye-sdk-client` module.

## `@deveye/types/sdk`

- `FeatureManifest`: the declaration; see [02-manifest](02-manifest.md).
- `ManifestCommand`: `{ command, input, output }`, zod both ways.
- `ExtraPermissionSpec`: `toggle` or `choice` (2..5 options, least-privileged
  `default`, explicit `ownerValue`). `MAX_EXTRA_PERMISSIONS = 4`.
- `NativeCapability`: `'notify' | 'mail.accounts' | 'members.read' |
  'devices.read' | 'telemetry.read' | 'agents' | 'routes.public'`;
  `'telemetry.read'` and `'agents'` are reserved to native-id modules
  (`validateManifest` refuses them on an `x-` id). `'routes.public'` opens
  sessionless HTTP routes (`FeatureService.publicRoutes`, see
  [10-background-services](10-background-services.md#public-http-routes-publicroutes)).
- `CrossTopicInvalidation`: `{ topic, keys }`, the element of the manifest's
  `alsoInvalidatedBy` (a native topic, a subset of `resources`; at most 4).
- `FeatureManifest.topics`: `{ id, keys }[]`, secondary live topics of your
  own (`id` prefixed by your feature id and different from it, `keys` a
  subset of `resources`), beaten by `mutates: ['<topic>']` or
  `live.changed(ws, ['<topic>'])`; see
  [02-manifest](02-manifest.md#secondary-topics-of-your-own).
- `SettingsTab` (`'general' | 'sources' | 'notifications' | 'permissions' | 'sync' | 'encryption'`;
  `'sync'` and `'encryption'` are item-scope tabs), `CustomTabRef`,
  `FeatureCategory`, `FeatureLink` (`{ to, what }`, `MAX_FEATURE_LINKS = 6`).
- `validateManifest(manifest)`: throws with a named reason.
- Ids: `externalFeatureIdSchema` (`/^x-[a-z][a-z0-9]{1,24}$/`), `featureIdSchema`,
  `isExternalFeatureId`, types `ExternalFeatureId`, `FeatureId`.
- Provider contracts (`providers.ts`, the inversion for app code that needs a
  module's data; see [10-background-services](10-background-services.md#offering-a-contract-to-the-host-providers)):
  `CLOUDSYNC_BACKUP_PROVIDER` (`'cloudsync.backup'`), `CloudSyncBackupProvider`
  (`findShare`, `listShares`, `statsByShare`, `listPresentFiles`, `openBlob`)
  and its row types `SyncBackupShare`, `SyncBackupStats`, `SyncBackupFile`;
  `UPTIME_ITEMS_PROVIDER` (`'uptime.items'`), `UptimeItemsProvider`
  (`exists(serviceId, workspaceId)`); `UPTIME_CLIENT_PROVIDER`
  (`'uptime.client'`, its contract `UptimeClientProvider` lives in
  `sdk/client`); `MAIL_CLIENT_PROVIDER` (`'mail.client'`, contract
  `MailClientProvider` in `sdk/client`: `listSenders()`, the ready senders an
  email notification channel picks from, and `AccountDialog`, the feature's
  own account form); `SENTINEL_AGENT_CONFIG_PROVIDER` (`'sentinel.agentConfig'`),
  `SentinelAgentConfig`, `SentinelAgentConfigProvider` (`configFor(deviceId)`);
  `DATABASE_BACKUP_PROVIDER` (`'database.backup'`), `DatabaseBackupProvider`
  (`listDatabases`, `findDatabase`, `openAccess`), `DatabaseBackupCandidate`,
  `DatabaseBackupAccess` (an open access, `close()` releases the tunnel):
  offered by the app while Databases is native, by its module afterwards.

## `@deveye/types/sdk/server`

- `FeatureServer`: your `./server` export: `features`, optional `createRepo(q)`,
  `migrationsDir`, `createService(deps)`, `items` (`FeatureItemsEntry`:
  `homeOf(repo, itemId, workspaceId)`, `labelOf(repo, cipher, itemId,
  workspaceId)`, required by a `shareTier` other than `'never'`). A module
  with migrations also ships `src/server/migrations/`' destructive mirror
  `src/server/uninstall.sql` (`DROP TABLE IF EXISTS` on its own `ft_<slug>_`
  tables only; see 04-storage-and-encryption).
- `SdkFeatureDefinition` / `defineSdkFeature`: one command:
  `access?: { level?: 'read' | 'write'; extras?: string[] }`,
  `mutates?: boolean | readonly string[]` (`true` beats your feature's own
  topic, its id; a list names the topics to beat instead: your id, one of
  your `manifest.topics`, or another feature's topic whose screens mirror
  this data; an unknown topic is refused at boot), `handler(ctx, input)`.
- `SdkFeatureContext<Repo>`: see [03-server-handlers](03-server-handlers.md).
  Carries `transport: SdkSocketTransport` (capability `'agents'`; every method
  throws `forbidden` otherwise), `secrecy: SdkSecrecy` (`isUnlocked()`, and
  `ticket(payload, { ttlSeconds? })`: a short-lived ticket signed by the host
  and bound to the caller, their session, this workspace and your module, that
  a public route of your service redeems with `deps.secrecy.redeem`; two
  minutes by default), `keys: SdkServerKeys` (the same object a service gets),
  `items: SdkItems` (`restrictions()`, `assert(itemId, level?)`,
  `forget(itemId)`), `sharing: SdkSharing` (`scope()` returning an
  `SdkShareScope`: `foreignIds`, `homeOf`, `cipherFor`) and
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
  `mail.listAccounts`, `members.list`,
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
  feature's), `audit` (system
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
  (`isOnline`, `requestScan`, `pushConfig`; `requestSyncConfig`,
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
- `SettingsPanelProps`: `{ scope, canWrite }`; `SdkSettingsScope` is
  `{ kind: 'feature' }` or `{ kind: 'item', itemId, itemLabel }`.

## `@deveye/types/sdk/testing`

- `createTestContext(overrides?)`: in-memory `SdkFeatureContext` plus
  `recorded` (notifications, audits, agentRequests, pinnedInstants),
  `forgotten` (the item ids passed to `items.forget`) and an inspectable
  `store.rows`. Its facade answers by default: `devices.authorize` resolves
  `testDevice({ id })` (active, online, unreported), `devices.list` is empty,
  `devices.isOnline` is true, `telemetry.snapshot` is null, `agents` records
  every request and answers true, `transport` is a no-op, `secrecy` is
  unlocked, `items.restrictions()` is empty and `sharing.scope()` has no
  projection. Overrides: `repo`, `userId`, `workspaceId`, `kind`, `isOwner`,
  `canWrite`, `extras`, `manifest`, `hasRoute`, `notifyAccepted` (what
  `notify.send` resolves; recorded either way), `devices`, `snapshots`,
  `deveye` (a partial facade), `unlocked` (false also seals the `'private'`
  cipher: `decrypt` throws `locked`, `tryDecrypt` answers null, like the
  app's guarded tier in a locked session), `itemRestrictions`, `shares`.
- `createTestServiceDeps(overrides?)`: the service twin; `recorded` adds
  `tickers` and `liveChanges`. Overrides: `repo`, `workspaceIds`, `devices`,
  `hasRoute`, `notifyAccepted`, `snapshots`.
- `testDevice(over)`: an `SdkDevice` with sensible defaults.

## `deveye-sdk-client` (provided by the app)

The list below mirrors `@deveye/types/src/sdk/client-ambient.d.ts`, the typed
portrait of the barrel that DevEye's own CI checks against the real one; it is
maintained separately from the server sections above, and that file is the
authority when the two differ.

- UI kit: `Button`, `TextInput`, `SelectInput`, `Checkbox`, `Switch`,
  `SegmentedControl`, `Dialog`, `DialogCancelButton`, `Popup` / `OpenPopup` /
  `ClosePopup` (the imperative dialog layer), `openInfo`, `StatusBadge`,
  `ConfirmDialog`, `FeatureSettingsButton`, `settingsStyles` (the canonical
  settings rows), `CountWidget` + `useWorkspaceCount` (+ `CountState`),
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
  slow third party).
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
- Shared helpers: `formatBytesFr`, `DeviceFolderPicker`, `useDevices`.
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
  (`'view' | 'l1' | 'l2' | 'l3' | 'l4'`).
- Host navigation and frame: `openFeature(feature, itemId?)` (open another
  feature of the active workspace, on one of its items), `useRequestPopupWidth(px | null)`
  (ask the feature popup for a wider frame while mounted), `useStickyOffset<T>()`
  (two sticky bands one under the other: `{ ref, style }`, the ref measures
  the top band, the style hands a common ancestor the `--sticky-head`
  variable the lower band offsets itself by; `StickyOffset<T>` is its type).

Anything not listed here is DevEye internal and may change without notice.
