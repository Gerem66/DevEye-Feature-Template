# Storage and encryption

## The rule, first

One argument decides how a value is protected:

```ts
await ctx.store.put('token', value); // 'server' (default)
await ctx.store.put('secret', value, { encryption: 'private' });
await ctx.store.put('color', value, { encryption: 'none' });
```

- **`'server'`, the default**: encrypted at rest, the server can always read
  it back. Right for API keys, tokens, cached data, anything a background job
  needs. Works in handlers AND in services. When in doubt, use this.
- **`'private'`**: for user secrets the server operator must not be able to
  read when the workspace owner enables password encryption. Handlers only:
  reads can throw `locked` (session sealed) or `forbidden` (foreign caller),
  and your UI must tolerate both. Client-side, `deveye-sdk-client` gives you
  the pieces: wrap the call in `withSecrecy(...)` to retry once after the
  global unlock prompt, or read `useSecrecy()` and keep the screen usable
  while showing locked rows as such. **Never available in background
  services**: if your scheduler needs the value, store a `'server'` projection
  instead.
- **`'none'`**: plaintext, for non-sensitive metadata you want to query in SQL.

The mode is stored per row, so a read always knows how to decrypt. The wrong
thing is made hard on purpose: the sessionless store's type does not accept
`'private'`, and reading a private row from a service throws loudly instead of
returning garbage.

## The KV store

`ctx.store` is scoped to your feature and the request's workspace. `putJson` /
`getJson` take a zod schema, so what you persist is validated both ways. Ideal
for lists, settings, small documents; the Counter example stores everything
this way and ships zero migrations.

## Your own tables

For relational data, declare tables and a repo:

1. SQL files in `src/server/migrations/`, numbered locally (`001_init.sql`),
   tables prefixed `ft_<slug>_`. DevEye applies them at boot, after its own,
   recorded as `<id>/<file>`. Never edit a shipped migration; add a number.
2. `serverEntry.createRepo(q)` builds your repo once per process; handlers get
   it as `ctx.repo`. Repos filter by `workspace_id` themselves, use `?`
   placeholders, and **never encrypt**: handlers pass values already sealed
   through `ctx.cipher()`.

```ts
// handler side
const sealed = await ctx.cipher().encrypt(apiKey); // 'server' tier
await ctx.repo.saveKey(ctx.workspaceId, sealed);
// reads: tryDecrypt returns null instead of throwing, for lists that degrade
```

Migrations run at boot without a transaction: make every statement replayable
(guard on INFORMATION_SCHEMA, no-op branch), exactly like DevEye's own.

## Beyond strings: `ctx.keys`, and tickets

`ctx.cipher()` and the store encrypt strings. Two things they do not cover:

- **Key material of your own.** A module that runs its own bulk encryption
  (files, streams) owns a raw symmetric key. `ctx.keys` (the same
  `SdkServerKeys` a service gets as `deps.keys`) wraps it under the server key
  (`sealBytes` / `openBytes`) or derives one from it (`derive(salt, info,
length)`: HKDF over the server key, never stored anywhere, for material
  that must survive the database). Details and the unwrap-at-start pattern in
  [10-background-services](10-background-services.md#wrapping-key-material-of-your-own-depskeys).
- **A browser request without a session.** A download the browser must open
  natively, an OAuth consent that comes back through the provider: no header
  to add, so no session. `ctx.secrecy.ticket(payload, { ttlSeconds? })` mints
  a short-lived ticket, signed by the host and bound to the caller (their
  session, this workspace, your module); a public route of your service
  redeems it with `deps.secrecy.redeem(ticket)` and gets the caller's ciphers
  back, private tier included while their session is unlocked. The module
  never sees a session id nor a key. See
  [10-background-services](10-background-services.md#tickets-a-public-route-acting-for-a-session).

## Files: the object store

Bytes too big for a table (a synced file, a backup archive) go to the host's
object store: `deps.objects(localDir)`, capability `'objects'`. The host decides
where they live: under `localDir` on its disk, or in the S3 bucket its operator
configured (`STORAGE_S3_*`), under a prefix of your module's own. Your code is
the same either way.

- A key is a relative path (`share-1/blobs/ab/cd/<hash>`): no leading `/`, no
  `..`. Store only the key in your tables, never where it resolves: the host
  can then move the whole tree to another disk or bucket without a row to
  rewrite.
- `put(key, bytes | stream)` and `putFile(key, localPath)` are atomic: a
  reader sees the whole object or none. `get(key, range?)` streams it back,
  `head` gives its size or `null`, `list(prefix)` walks a prefix,
  `delete` is idempotent, `deletePrefix('share-1/')` removes a whole tree.
- What cannot be written in one go (a partial upload resumed later, which is
  read back, truncated and extended) belongs in `spoolDir()`, a directory on
  the host's disk whatever the store, then `putFile` once finished.
- `ephemeralRoot()` gives the store's root when files written there would
  not last (inside a container, a directory on no mounted volume, wiped at
  the next redeploy), `null` otherwise. Refuse to write then, naming the
  variable that sets your `localDir`: the files would vanish without a word.
- `kind` says `'s3'` when every byte read costs egress: skip what rereads
  everything in the background there (a periodic integrity scan), the
  provider checks its objects itself.
- Encrypt before you store: the store keeps bytes as given. Wrap your own key
  with `deps.keys` (above).

In tests, `createTestServiceDeps` hands out a `memoryObjectStore()` from
`@deveye/types/sdk/testing`; pass `{ objects }` to share one with your
assertions.

## Uninstall

A module that declares migrations must also ship their destructive mirror:
`src/server/uninstall.sql`, dropping every table the migrations created
(`DROP TABLE IF EXISTS ft_<slug>_...;` — idempotent, so a failed cleanup can
simply be re-run). DevEye's `scripts/uninstall-feature.ts` executes it when an
administrator removes your module, then cleans everything the app stored FOR
you (KV rows, migration records, notification channels and routes, role
grants, placed tiles). The file may only touch your `ft_<slug>_` prefix —
both that script and `gen:features` refuse anything else. No migrations, no
tables, no `uninstall.sql` needed: the app side is cleaned either way.
