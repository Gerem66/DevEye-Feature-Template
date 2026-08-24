# API reference

The surface, type by type. Sources of truth: `@deveye/types/sdk` (shared),
`@deveye/types/sdk/server`, `@deveye/types/sdk/client`, `@deveye/types/sdk/testing`,
and the app-provided `deveye-sdk-client` module.

## `@deveye/types/sdk`

- `FeatureManifest`: the declaration; see [02-manifest](02-manifest.md).
- `ManifestCommand`: `{ command, input, output }`, zod both ways.
- `ExtraPermissionSpec`: `toggle` or `choice` (2..5 options, least-privileged
  `default`, explicit `ownerValue`). `MAX_EXTRA_PERMISSIONS = 4`.
- `NativeCapability`: `'notify' | 'mail.accounts' | 'members.read'`.
- `SettingsTab`, `CustomTabRef`, `FeatureCategory`.
- `validateManifest(manifest)`: throws with a named reason.
- Ids: `externalFeatureIdSchema` (`/^x-[a-z][a-z0-9]{1,24}$/`), `featureIdSchema`,
  `isExternalFeatureId`, types `ExternalFeatureId`, `FeatureId`.

## `@deveye/types/sdk/server`

- `FeatureServer`: your `./server` export: `features`, optional `createRepo(q)`,
  `migrationsDir`, `createService(deps)`. A module with migrations also ships
  `src/server/migrations/`' destructive mirror `src/server/uninstall.sql`
  (`DROP TABLE IF EXISTS` on its own `ft_<slug>_` tables only — see
  04-storage-and-encryption).
- `SdkFeatureDefinition` / `defineSdkFeature`: one command:
  `access?: { level?: 'read' | 'write'; extras?: string[] }`, `mutates?: boolean`,
  `handler(ctx, input)`.
- `SdkFeatureContext<Repo>`: see [03-server-handlers](03-server-handlers.md).
- `FeatureStore`: `put/putJson/get/getJson/remove/keys`; `putJson`/`getJson`
  take a zod schema. `StorageEncryption = 'server' | 'private' | 'none'`.
- `SessionlessFeatureStore`: the service variant; `'private'` unrepresentable.
- `SdkCipher`: `encrypt`, `decrypt` (throws), `tryDecrypt` (null).
- `SdkQueryable`: `query<T>(sql, params): Promise<T[]>`,
  `execute(sql, params): Promise<{ affectedRows, insertId }>`.
- `DevEyeFacade`: `notify.hasRoute/send`, `mail.listAccounts`, `members.list`;
  each gated by the manifest's `nativeCapabilities`.
- `FeatureService` (`start/stop`), `FeatureServiceDeps` (incl. `createTicker`).
- `FeatureError(code, message, details?)`: codes `validation`, `forbidden`,
  `not_found`, `conflict`, `locked`, `internal`.

## `@deveye/types/sdk/client`

- `FeatureClient`: your `./client` export: `Widget` (no props),
  `Full({ closeFeature })`, `settingsPanels?`, `TopbarWidget?` (no props: it
  may only show what your own commands return, which the server authorizes
  against the caller's grants), `cacheDurationMinutes?`,
  `preload?`, `holdSecrecy?`.
- `SettingsPanelProps`: `{ scope, canWrite }`; `SdkSettingsScope` is
  `{ kind: 'feature' }` or `{ kind: 'item', itemId, itemLabel }`.

## `@deveye/types/sdk/testing`

- `createTestContext(overrides?)`: in-memory `SdkFeatureContext` plus
  `recorded` (notifications, audits) and an inspectable `store.rows`.
  Overrides: `repo`, `userId`, `workspaceId`, `kind`, `isOwner`, `canWrite`,
  `extras`, `hasRoute`, `deveye`.

## `deveye-sdk-client` (provided by the app)

- UI kit: `Button`, `TextInput`, `SelectInput`, `Checkbox`, `Switch`,
  `SegmentedControl`, `Dialog`, `StatusBadge`, `ConfirmDialog`,
  `FeatureSettingsButton`, `settingsStyles` (the canonical settings rows).
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
