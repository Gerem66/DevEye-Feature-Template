# Server handlers

One `defineSdkFeature` per command, exported together from `src/server/index.ts`
as `serverEntry.features`.

```ts
defineSdkFeature({
    ...counterReset,                       // { command, input, output } from your contracts
    access: { level: 'write', extras: ['reset'] },
    mutates: true,                         // broadcast your topic on success
    handler: async (ctx, input) => {
        // input is already validated; the caller already has write access
        // AND the reset extra in this workspace.
        ...
        return state;                      // validated against `output` before it leaves
    }
});
```

`mutates` is `true` (beat your feature's topic, its id, on success) or a list
of the topics to beat instead: your id, one of your secondary topics
(`manifest.topics`, [02-manifest](02-manifest.md#secondary-topics-of-your-own)),
or another feature's topic whose screens mirror this data. An unknown topic
is refused at boot. Leave it out on a read.

## The context, member by member

| Member                                                                                     | What                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.userId`, `ctx.workspaceId`, `ctx.workspace`                                           | who, where; `workspace.kind` is `'personal'` or `'shared'`                                                                                                                                                                                                                                                                                                                                                       |
| `ctx.isOwner`, `ctx.canWrite`                                                              | resolved rights on YOUR feature                                                                                                                                                                                                                                                                                                                                                                                  |
| `ctx.isAdmin`                                                                              | the caller is a global administrator of this DevEye; a command that must REQUIRE it declares `access: { admin: true }`                                                                                                                                                                                                                                                                                           |
| `ctx.canExtra(key)`, `ctx.extraValue(key)`                                                 | your declared permissions; fail-closed defaults                                                                                                                                                                                                                                                                                                                                                                  |
| `ctx.repo`                                                                                 | your own repo, if you declared `createRepo` (features with tables)                                                                                                                                                                                                                                                                                                                                               |
| `ctx.store`                                                                                | the per-feature, per-workspace KV store                                                                                                                                                                                                                                                                                                                                                                          |
| `ctx.cipher(mode?)`                                                                        | a cipher for your own tables; default `'server'`                                                                                                                                                                                                                                                                                                                                                                 |
| `ctx.deveye`                                                                               | native features, gated by `nativeCapabilities`; see [below](#native-features-through-ctxdeveye)                                                                                                                                                                                                                                                                                                                  |
| `ctx.transport`                                                                            | the caller's own browser socket; capability `'agents'` only, reserved to DevEye's modules ([10-background-services](10-background-services.md#the-agent-fleet-reserved)); every method throws `forbidden` otherwise                                                                                                                                                                                              |
| `ctx.secrecy.isUnlocked()`, `ctx.secrecy.ticket(payload, opts?)`                           | whether the guarded tier is readable in this session; ask it when you must decide BEFORE reading (list private rows as masked, refuse an edit that would overwrite a body the session cannot see); a `'private'` read throws `locked` on its own. `ticket` mints a signed pass a public route of yours redeems ([10-background-services](10-background-services.md#tickets-a-public-route-acting-for-a-session)) |
| `ctx.items.restrictions()`, `ctx.items.assert(itemId, level?)`, `ctx.items.forget(itemId)` | your items as the workspace's roles see them: the caller's role restrictions (`'none'` hidden, `'read'` read-only, restrictive only), the per-item guard commands targeting one item call first, and the removal bookkeeping (projections, restrictions, notification route) your delete handler calls, since nothing links those rows to your table                                                             |
| `ctx.sharing.scope()`                                                                      | what is projected INTO the active workspace (`foreignIds`, `homeOf(itemId)`, `cipherFor(itemId)`: the open cipher of the item's home, the only way to read a projected row); throws `forbidden` under `shareTier: 'never'`                                                                                                                                                                                       |
| `ctx.providers.get<T>(key)`                                                                | a published contract another feature offers (`sdk/providers.ts`), whoever offers it, without knowing which module; `undefined` when nobody does, degrade cleanly (see [10-background-services](10-background-services.md#consuming-a-contract-providersget))                                                                                                                                                     |
| `ctx.keys`                                                                                 | seal, open and derive raw symmetric keys, for what a string store cannot hold (see [04-storage-and-encryption](04-storage-and-encryption.md#beyond-strings-ctxkeys-and-tickets))                                                                                                                                                                                                                                 |
| `ctx.origins`                                                                              | `{ app, public }`, where this DevEye lives; never guess it from the browser                                                                                                                                                                                                                                                                                                                                      |
| `ctx.audit({ action, description })`                                                       | fire-and-forget audit line; actor and workspace pre-bound                                                                                                                                                                                                                                                                                                                                                        |
| `ctx.logger`, `ctx.requestId`                                                              | structured logging                                                                                                                                                                                                                                                                                                                                                                                               |

What is deliberately absent: other features' data (use the facade), the raw
database (use your repo and store), the session, the encryption keys.

## Native features, through `ctx.deveye`

Each facade answers only if the manifest declares its capability (the list is
in [02-manifest](02-manifest.md#native-capabilities)); otherwise the call
throws `forbidden`.

- `notify.hasRoute(itemId?)`, `notify.send(alert, { itemId? })`: see
  [08-notifications](08-notifications.md).
- `mail.listAccounts()`: `{ id, label, address }` for the workspace's open-tier
  mail accounts; never credentials.
- `members.list()`: `{ userId, name, isOwner, color }` per member.
- `devices.list()`: the devices this workspace sees (its own, or the whole
  fleet for a global administrator in their personal workspace, DevEye's own
  rule for its device list), each as `{ id, name, online, status,
ownerUserId, workspaceId, metricIntervalSeconds, report }`;
  `devices.isOnline(id)`: presence, synchronous; `devices.authorize(id)`: the
  device when it exists and belongs to this workspace, a throw otherwise
  (`not_found` for an unknown id). Call `authorize` before acting on a device
  id the client sent: the id is caller input, and this check is what ties it
  to the request's workspace.
- `telemetry`: the devices' metric store, capability `'telemetry.read'`,
  reserved to DevEye's own modules.
- `agents`: the agent-fleet transport, capability `'agents'`, reserved to
  DevEye's own modules.

## Errors

Throw `FeatureError(code, message)` for a clean, typed reply:
`validation`, `forbidden`, `not_found`, `conflict`, `locked`, `internal`.
Anything else becomes an opaque `internal` error with a server-side log.

## Testing

`createTestContext()` from `@deveye/types/sdk/testing` gives you a fully
in-memory context: identity ciphers, a recording facade
(`ctx.recorded.notifications`), a store whose rows you can inspect
(`ctx.store.rows`). Call your handlers directly from `node:test` files; see
`src/server/handlers.test.ts`.
