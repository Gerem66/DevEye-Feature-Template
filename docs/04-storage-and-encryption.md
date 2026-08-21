# Storage and encryption

## The rule, first

One argument decides how a value is protected:

```ts
await ctx.store.put('token', value);                            // 'server' (default)
await ctx.store.put('secret', value, { encryption: 'private' });
await ctx.store.put('color', value, { encryption: 'none' });
```

- **`'server'`, the default**: encrypted at rest, the server can always read
  it back. Right for API keys, tokens, cached data, anything a background job
  needs. Works in handlers AND in services. When in doubt, use this.
- **`'private'`**: for user secrets the server operator must not be able to
  read when the workspace owner enables password encryption. Handlers only:
  reads can throw `locked` (session sealed) or `forbidden` (foreign caller),
  and your UI must tolerate both. **Never available in background services**:
  if your scheduler needs the value, store a `'server'` projection instead.
- **`'none'`**: plaintext, for non-sensitive metadata you want to query in SQL.

The mode is stored per row, so a read always knows how to decrypt. The wrong
thing is made hard on purpose: the sessionless store's type does not accept
`'private'`, and reading a private row from a service throws loudly instead of
returning garbage.

## The KV store

`ctx.store` is scoped to your feature and the request's workspace. `putJson` /
`getJson` take a zod schema, so what you persist is validated both ways. Ideal
for lists, settings, small documents; the Countdown example stores everything
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
const sealed = await ctx.cipher().encrypt(apiKey);      // 'server' tier
await ctx.repo.saveKey(ctx.workspaceId, sealed);
// reads: tryDecrypt returns null instead of throwing, for lists that degrade
```

Migrations run at boot without a transaction: make every statement replayable
(guard on INFORMATION_SCHEMA, no-op branch), exactly like DevEye's own.
