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
  'devices.read' | 'telemetry.read' | 'agents'`; the last two are reserved to
  native-id modules (`validateManifest` refuses them on an `x-` id).
- `CrossTopicInvalidation`: `{ topic, keys }`, the element of the manifest's
  `alsoInvalidatedBy` (a native topic, a subset of `resources`; at most 4).
- `SettingsTab`, `CustomTabRef`, `FeatureCategory`.
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
  `sdk/client`); `SENTINEL_AGENT_CONFIG_PROVIDER` (`'sentinel.agentConfig'`),
  `SentinelAgentConfig`, `SentinelAgentConfigProvider` (`configFor(deviceId)`).

## `@deveye/types/sdk/server`

- `FeatureServer`: your `./server` export: `features`, optional `createRepo(q)`,
  `migrationsDir`, `createService(deps)`, `items` (`FeatureItemsEntry`:
  `homeOf(repo, itemId, workspaceId)`, `labelOf(repo, cipher, itemId,
  workspaceId)`, required by a `shareTier` other than `'never'`). A module
  with migrations also ships `src/server/migrations/`' destructive mirror
  `src/server/uninstall.sql` (`DROP TABLE IF EXISTS` on its own `ft_<slug>_`
  tables only; see 04-storage-and-encryption).
- `SdkFeatureDefinition` / `defineSdkFeature`: one command:
  `access?: { level?: 'read' | 'write'; extras?: string[] }`, `mutates?: boolean`,
  `handler(ctx, input)`.
- `SdkFeatureContext<Repo>`: see [03-server-handlers](03-server-handlers.md).
  Carries `transport: SdkSocketTransport` (capability `'agents'`; every method
  throws `forbidden` otherwise), `secrecy: SdkSecrecy` (`isUnlocked()`),
  `items: SdkItems` (`restrictions()`, `assert(itemId, level?)`,
  `forget(itemId)`) and `sharing: SdkSharing` (`scope()` returning an
  `SdkShareScope`: `foreignIds`, `homeOf`, `cipherFor`).
- `FeatureStore`: `put/putJson/get/getJson/remove/keys`; `putJson`/`getJson`
  take a zod schema. `StorageEncryption = 'server' | 'private' | 'none'`.
- `SessionlessFeatureStore`: the service variant; `'private'` unrepresentable.
- `SdkCipher`: `encrypt`, `decrypt` (throws), `tryDecrypt` (null).
- `SdkQueryable`: `query<T>(sql, params): Promise<T[]>`,
  `execute(sql, params): Promise<{ affectedRows, insertId }>`.
- `DevEyeFacade`: `notify.hasRoute/send` (an `SdkAlert`: `subject`, `body`,
  `payload?`, `embeds?`), `mail.listAccounts`, `members.list`,
  `devices.authorize/list/isOnline`, `telemetry` (an `SdkTelemetry`:
  `snapshot(deviceId, ts)` returning an `SdkTelemetrySnapshot` or null,
  `pinInstant(deviceId, ts)`), `agents` (an `AgentsFacade`); each gated by
  the manifest's `nativeCapabilities`.
- `SdkDevice`: `{ id, name, online, status, ownerUserId, workspaceId,
  metricIntervalSeconds, report }`, what the devices facade reveals.
- `FeatureService`: `start` (may be async; awaited at boot, before the agent
  sockets open), `stop`, `agentHooks?: FeatureAgentHooks`,
  `providers?: Readonly<Record<string, unknown>>` (keyed by a published
  provider key).
- `FeatureServiceDeps<Repo>`: `repo`, `listWorkspaceIds`, `storeFor`,
  `cipherFor` (open tier), `deveyeFor` (notify only), `devicesFor` (`list`,
  `isOnline`), `devices` (`SdkFleetDevices`: `find`, `isOnline`),
  `telemetry`, `live` (`SdkLive`: `changed(workspaceId)`), `audit` (system
  source, optional `userId`), `agents`, `keys`,
  `createTicker({ intervalMs, tick })`, `logger`.
- `SdkServerKeys`: `sealBytes(Uint8Array): string`,
  `openBytes(string): Uint8Array | null` (null: tampered, or server keys
  changed). Server key, module-owned key material only, never user data.
- Reserved to native-id modules (capability `'agents'`): `AgentsFacade`
  (`isOnline`, `requestScan`, `pushConfig`; `requestSyncConfig`,
  `requestSyncScan`, `requestSyncPush`,
  `requestSyncApplyChunk`, `requestSyncApplyStart`, `requestSyncApplyDir`,
  `requestSyncApplyLocal`, `requestSyncMove`, `requestSyncDelete`, each
  `false` when the agent is offline; `publishSyncProgress`,
  `publishSyncState`), `SdkSocketTransport` (`subscribeSync`,
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
  `Full({ closeFeature })`, `settingsPanels?`, `TopbarWidget?` (no props: it
  may only show what your own commands return, which the server authorizes
  against the caller's grants), `cacheDurationMinutes?`,
  `preload?`, `holdSecrecy?`, `providers?` (named contracts offered to the
  host's screens; `UptimeClientProvider` with `UptimeLinkedService`,
  `UptimeHistoryPoint`, `UptimeHistoryResolution` is the one published).
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
  `canWrite`, `extras`, `manifest`, `hasRoute`, `devices`, `snapshots`,
  `deveye` (a partial facade), `unlocked` (false also seals the `'private'`
  cipher: `decrypt` throws `locked`, `tryDecrypt` answers null, like the
  app's guarded tier in a locked session), `itemRestrictions`, `shares`.
- `createTestServiceDeps(overrides?)`: the service twin; `recorded` adds
  `tickers` and `liveChanges`. Overrides: `repo`, `workspaceIds`, `devices`,
  `hasRoute`, `snapshots`.
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
  `useDragReorder`.
- `useDialogClose()`: the enclosing `Dialog`'s guarded close (unsaved-changes
  prompt included).
- `useDialogSubmit(fn | null)`: `fn` becomes the enclosing `Dialog`'s primary
  action (Enter triggers it); `null` clears it.
- `useDismissLayer(open, onEscape | null)`: registers the topmost dismissible
  layer while `open`, so Escape closes overlays innermost first; `null`
  absorbs Escape without closing.
- Data: `useResource(key, load, fallback, deps?)`, `invalidate(...keys)`,
  `useResourceVersion(key)`, `onResourceChange(key, cb)`,
  `humanizeError(e, fallback)`, `featureApi(manifest)` (typed `send`, with an
  optional `{ timeoutMs }` for commands that query a slow third party).
- Password-based encryption: `useSecrecy()` (live lock state), `withSecrecy(run)`
  (retry once after the unlock prompt on a `locked` error),
  `ensureSecrecyUnlocked()` (explicit unlock gesture). Needed as soon as one of
  your commands reads `'private'` data.
- Live: `useLiveSegment`, `useLiveItemTarget`, `useLiveOutline(s)` (+
  `LiveOutlineProps`), `useTypers`, `useTypingSignal`.
- Push events: `onServerEvent(event, schema, cb)` (typed server-push
  subscription), `onSocketOpen(cb)` (the resubscribe-on-reconnect primitive),
  `isSocketOpen()`.
- Shared helpers: `formatBytesFr`, `DeviceFolderPicker`, `useDevices`.
- Rights and workspace: `useWorkspacePermissions()` (incl. `canExtra`,
  `extraValue`), `useActiveWorkspace()` (`.kind`), `useFeatureLifecycle`.

Anything not listed here is DevEye internal and may change without notice.
