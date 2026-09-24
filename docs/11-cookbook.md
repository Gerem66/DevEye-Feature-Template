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

## Serve something on the customer's own domain

Declare `domains` in the manifest and on the server entry
([06-settings-panels](06-settings-panels.md#domains)), add the
`'routes.public'` capability, then route by host:

```ts
app.get('/page/:slug', {}, async (req, reply) => {
    const domain = await deps.domains.findByHost(req.host ?? '');
    if (!domain?.verified) return reply.code(404).send();
    const row = await deps.repo.findBySlug(domain.id, String((req.params as { slug: string }).slug));
    // ...
});
```

Outside a customer's domain (on `origins.public`), the same route serves the
item by an unguessable reference instead; under a customer's domain, serve
nothing but the workspace that owns it.

When the name IS the page (`status.example.com`, not a prefix of your
routes), answer at its root with `domainRoot` on the service. The host calls
it for `GET /` once the request's host matched a verified domain of yours,
and hands you that domain: route by it, never by the header.

```ts
createService(deps) {
    return {
        start() {},
        stop() {},
        async domainRoot(_req, reply, domain) {
            const page = await deps.repo.pageForDomain(domain.id);
            if (!page || page.workspace_id !== domain.workspaceId) return reply.code(404).send();
            // ...
        }
    };
}
```

Test the hooks with `createTestDomainsContext({ dns: { mx: async () => [...] } })`
and the routing with `createTestServiceDeps({ domains: [testDomain({ id: 1, host: 'a.example.com' })] })`.

## Let your items be copied to another workspace

Describe what an item is made of, once; the host copies it, to another workspace
of this DevEye or of ANOTHER one (the user's browser carries it, the two servers
never talk). The same tree gives your `move` its cells.

```ts
export const boardTree: ItemTree = [
    {
        table: 'ft_myfeature_boards',
        idColumn: 'id',
        ownerColumn: 'id', // the root owns itself
        workspaceColumn: 'workspace_id',
        orderColumn: 'sort_order', // the copy lands last
        unique: { column: 'name_ref', message: 'A board of that name already exists there.' },
        sealed: ['content'],
        omit: ['credential_id', 'last_sync_at'] // means nothing elsewhere
    },
    { table: 'ft_myfeature_cards', idColumn: 'id', ownerColumn: 'board_id', sealed: ['content'] },
    { table: 'ft_myfeature_history', idColumn: 'id', ownerColumn: 'board_id', sealed: ['content'], cache: true }
];

serverEntry: {
    items: {
        homeOf, labelOf,
        copy: {
            tree: boardTree,
            plan: async () => ({ blockers: [], drops: ['Its history, which the copy rebuilds'] }),
            admit: ({ repo, quota }) => quota.assert('boards', async (owned) => (await repo.countIn(owned)) + 1)
        }
    }
}
```

List EVERY encrypted column under `sealed`: one left out is copied as a blob no
key of the destination can open, and nothing can detect it. A table the
destination rebuilds by itself is `cache: true`: moved, never copied.

## Test a handler's permission gate

```ts
const ctx = createTestContext({ isOwner: false, extras: {} });
await assert.rejects(() => handler(ctx, input), /Permission/);
```
