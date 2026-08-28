# The manifest

One file, `src/manifest.ts`, declares everything DevEye knows about your
feature. There is no other registration point: the app's generated glue reads
the manifest and wires the catalog, the settings shell, the role editor, the
invalidation bus and the command registry from it.

Use `satisfies FeatureManifest` (not a type annotation): it keeps your literal
command names, which is what makes `featureApi(manifest)` fully typed.

## Fields

| Field | What it drives |
|---|---|
| `id` | `x-<slug>`; command prefix, live topic, resource and table prefixes |
| `label`, `description`, `icon`, `category` | the home-grid card, the add market, the roles screen row |
| `notifies` | the Notifications settings tab and the channels grant; required for the `notify` capability |
| `hasItems`, `itemNoun` | per-item settings screens ("Settings of this service") |
| `sources` | the feature-scope Sources tab (API keys, destinations); `hint` is its lead sentence |
| `shareTier` | must be `'never'` for external modules for now; anything else commits a module to the sharing contract (a server `items` entry, listings that read `ctx.sharing.scope()`), which DevEye's own modules use |
| `tile.compact` | half-height card, like device tiles |
| `links` | data links to other features (`{ to, what }`, at most 6), read in both directions by the home grid's "About" card |
| `topbarWidget` | offers your `TopbarWidget` component in the navbar widget picker; `description` is its subtitle there |
| `resources` | the client cache keys your topic refreshes |
| `invalidatedByTopic` | subset of `resources` refreshed on broadcast (default: all) |
| `topics` | secondary live topics of your own, beaten apart from your id (a chat thread that must not re-fetch the board); see [below](#secondary-topics-of-your-own) |
| `alsoInvalidatedBy` | keys of yours ALSO refreshed when a native topic fires; see [below](#refreshing-on-another-features-topic) |
| `settings` | which tabs exist, per scope; see [06-settings-panels](06-settings-panels.md) |
| `extraPermissions` | your own permissions in the role editor; see [07-permissions](07-permissions.md) |
| `nativeCapabilities` | which `ctx.deveye` facades you may call; undeclared calls throw; the full list is [below](#native-capabilities) |
| `commandPrefix` | reserved for DevEye's own modules; never set it (see [below](#reserved-for-deveyes-own-modules)) |
| `commands` | your zod contracts; every name must start with `<id>.` |

## Native capabilities

`nativeCapabilities` is what an administrator reads before installing your
module: every facade your server code can reach, and nothing else. A call
through a facade you did not declare throws `forbidden`. The full list, as
the `NativeCapability` type in `@deveye/types/sdk`:

| Capability | What it opens |
|---|---|
| `'notify'` | `ctx.deveye.notify` and `deps.deveyeFor(id).notify`: send through the channels the workspace routed to you; pair it with `notifies: true`, which gives the workspace the tab to route them ([08-notifications](08-notifications.md)) |
| `'mail.accounts'` | `ctx.deveye.mail.listAccounts()`: the workspace's open-tier mail accounts, metadata only (`id`, `label`, `address`), never credentials |
| `'members.read'` | `ctx.deveye.members.list()`: `{ userId, name, isOwner }` per member |
| `'devices.read'` | `ctx.deveye.devices` (`authorize`, `list`, `isOnline`) in handlers, `deps.devicesFor(id)` (`list`, `isOnline`) and `deps.devices` (`find`, `isOnline`, the whole fleet) in services ([03-server-handlers](03-server-handlers.md#native-features-through-ctxdeveye)) |
| `'telemetry.read'` | the devices' telemetry (`ctx.deveye.telemetry`, `deps.telemetry`); **reserved**, see below |
| `'agents'` | the agent-fleet sync transport; **reserved**, see below |

## Secondary topics of your own

Your id is your topic: every `mutates: true` command beats it, and every
member's client re-fetches `invalidatedByTopic`. When one kind of write is far
more frequent than the rest and touches far less (a message in a thread, next
to a board, a timeline and a list), beating the whole feature on each of them
re-fetches everything for nothing. Declare a secondary topic instead:

```ts
resources: ['x-board.list', 'x-board.board', 'x-board.messages'],
invalidatedByTopic: ['x-board.list', 'x-board.board'],
topics: [{ id: 'x-boardChat', keys: ['x-board.messages', 'x-board.list'] }]
```

Rules, checked by `validateManifest`:

- `id` starts with your feature id and differs from it (`x-boardChat` for
  `x-board`): letters, digits and dashes, at most 32 characters.
- `keys` is a subset of your `resources`: a topic only ever refreshes keys you
  own. A key may sit under several topics (the list above shows unread
  counts, so the chat beats it too).

A handler beats a secondary topic with `mutates: ['x-boardChat']` instead of
`true` ([03-server-handlers](03-server-handlers.md)); a background service
with `deps.live.changed(workspaceId, ['x-boardChat'])`
([09-live](09-live.md#writes-without-a-command)). The generated glue registers
each secondary topic on the client bus exactly like your main one, so
`useResource` needs nothing more. DevEye's own Projects module is the
reference: `projects` for the structure, `projectsChat` for the threads.

## Refreshing on another feature's topic

Your topic covers your own writes. When rows of yours embed data a native
feature owns, declare the coupling instead of polling:

```ts
alsoInvalidatedBy: [{ topic: 'devices', keys: ['x-myfeature.list'] }]
```

`topic` is a native live topic (a native feature's id such as `devices`, or
`workspace` for members, roles and the workspace's name); `keys` is the subset
of your `resources` to re-fetch when it beats. Native topics only, never your
own (a secondary topic of yours is `topics`, above), at most 4 entries: it is
the escape hatch for real data coupling (a share list that shows device names
must refresh when a device is renamed), not a general subscription mechanism.

## Reserved for DevEye's own modules

Three declarations exist for DevEye's native features migrated onto this same
contract, and `validateManifest` refuses them on an `x-` id:

- **`nativeCapabilities: ['agents']`**: the agent-fleet sync transport
  (outbound requests to the agent installed on the workspace's devices, the
  fan-out to browsers, per-socket subscriptions), together with
  `ctx.transport` and `FeatureService.agentHooks`. The agent protocol is app
  infrastructure, the contract between DevEye and its own agent binary, and
  its payload types live outside the `sdk*` entries whose stability the SDK
  promises: a third-party module cannot depend on it. What a module may know
  about devices is behind `'devices.read'`. Details, for the record, in
  [10-background-services](10-background-services.md#the-agent-fleet-reserved).
- **`nativeCapabilities: ['telemetry.read']`**: the devices' metric store
  (`telemetry.snapshot(deviceId, ts)`, the process list and metric row
  nearest an instant; `telemetry.pinInstant(deviceId, ts)`, so retention
  never prunes the evidence a finding rests on). App infrastructure like the
  agent protocol, and reserved for the same reason.
- **`commandPrefix`**: overrides the `<id>.` prefix checked on commands and
  resources, and must still equal `<id>.` case-insensitively. It exists
  because one native id (`cloudsync`) has always owned `cloudSync.*`
  commands. Your prefix is `x-<slug>.`, and nothing else.

## Validation

`validateManifest(manifest)` runs three times: in this repo's CI
(`npm run validate`), at install time (`npm run gen:features` in DevEye), and
at the app's boot. The same violation fails in the same words at each fence;
you will simply meet it at the earliest one.

## What stays out of the manifest

Anything executable for the app: your components live in the client entry,
your handlers in the server entry. The manifest is data, so both bundles can
load it without dragging the other's world in.
