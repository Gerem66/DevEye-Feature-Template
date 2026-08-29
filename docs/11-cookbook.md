# Cookbook

Task-shaped recipes. Each one is complete; adapt names.

## Store a workspace API key

```ts
// manifest: sources: { hint: 'API keys for ...' }, settings: { feature: ['sources'] }
// handler (gate it with an extra if the key is sensitive):
await ctx.store.put('apiKey', input.key); // 'server': readable by your service
// service:
const key = await deps.storeFor(workspaceId).get('apiKey');
```

## Alert when X happens

```ts
// manifest: notifies: true, nativeCapabilities: ['notify']
if (thresholdCrossed) {
    await ctx.deveye.notify.send({ subject: 'X crossed', body: `Now at ${value}.`, payload: { value } });
}
```

## A per-user secret (not even the operator can read it)

```ts
await ctx.store.put(`secret:${ctx.userId}`, value, { encryption: 'private' });
// reading can throw 'locked': surface it, the client shows the unlock prompt
```

## Make items teleportable and outlined

```ts
// manifest: hasItems: true, itemNoun: 'job'
// view: useLiveItemTarget('l1', opened === null ? null : String(opened), listLoaded, apply)
// rows: {...useLiveOutlines('l1')(String(row.id))}
```

## Refresh another of your keys after a write

```ts
// manifest: resources: ['x-f.list', 'x-f.stats']
await api.send('x-f.add', input);
invalidate('x-f.list', 'x-f.stats'); // local; peers refresh via your topic
```

## Gate one dangerous command behind a role choice

```ts
// manifest: extraPermissions: [{ key: 'purge', type: 'toggle', ... }]
defineSdkFeature({ ...purgeCmd, access: { level: 'write', extras: ['purge'] }, mutates: true, handler });
// client: show the button only when canExtra('x-f', 'purge')
```

## Act on a device the client named

```ts
// manifest: nativeCapabilities: ['devices.read']
const device = await ctx.deveye.devices.authorize(input.deviceId); // throws unless it is this workspace's
if (!ctx.deveye.devices.isOnline(device.id)) throw new FeatureError('conflict', 'Device offline');
// service side: deps.devicesFor(workspaceId).list()   (same gate, no authorize)
```

## Keep a raw key of your own

```ts
// service only: deps.keys wraps bytes under the SERVER key; never user data
await store.put('blobKey', deps.keys.sealBytes(randomBytes(32)), { encryption: 'none' });
const raw = deps.keys.openBytes((await store.get('blobKey')) ?? ''); // null = refuse to start
```

## Ship your own table

```
src/server/migrations/001_init.sql   -- CREATE TABLE ft_myfeature_rows (... workspace_id INT NOT NULL ...)
serverEntry: { createRepo, features, migrationsDir: new URL('./migrations', import.meta.url).pathname }
```

Guard every statement for replay (INFORMATION_SCHEMA probe + no-op branch);
DevEye's own migrations are the pattern to copy.

## Test a handler's permission gate

```ts
const ctx = createTestContext({ isOwner: false, extras: {} });
await assert.rejects(() => handler(ctx, input), /Permission/);
```
