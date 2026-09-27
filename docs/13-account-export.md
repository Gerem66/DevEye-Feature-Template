# The holder's data export

Any account can download everything it holds on a DevEye instance (GDPR
portability): Profile, then "Exporter mes données". The instance asks for the
password, then streams a `.zip` while it is downloaded, through a link that
works once. Nothing is stored. Everything in it is **plaintext**, the guarded
tier included: the holder typed their password for it.

The host writes the account, its workspaces, and for each feature its
`FeatureStore` (as `preferences.json`). Your tables are yours to declare.

## Declaring your tables

As soon as you own a table, set `accountExport` on your server entry, and give
**every** table a fate:

```ts
accountExport: {
    tables: {
        ft_demo_items: {
            file: 'items.json',
            where: 'workspace_id = ?',
            key: ['id'],
            sealed: ['content'],
            json: ['content'],
            dates: { created: 's' }
        },
        // A child table: select it through its parent.
        ft_demo_events: {
            file: 'events.json',
            where: 'item_id IN (SELECT id FROM ft_demo_items WHERE workspace_id = ?)',
            key: ['id']
        },
        ft_demo_credentials: { skip: 'Des identifiants de connexion à un service tiers.' },
        ft_demo_cache: { skip: 'Un cache, reconstruit par la synchronisation.' }
    },
    store: { omit: ['apiKey'] }
}
```

- `where` has exactly one `?`: the workspace id, or the holder's user id with
  `scope: 'account'` (for what you keep per account rather than per workspace).
- `key` is a unique ordering key: the host pages large tables with it, so a
  table of millions of rows never loads whole.
- `sealed` columns are opened whatever their tier, and lose an `_enc` suffix
  (`title_enc` is written as `title`); `json` ones are written as values;
  `dates` turns epoch columns into ISO 8601.
- `omit` columns never leave the server. `skip` leaves a whole table out; its
  sentence, in French, is what the holder reads in the archive's `LISEZMOI.txt`.
- `store.omit` hides the keys of your `FeatureStore` that hold a secret.

## What never goes in

Password hashes, key material, session and device tokens, credentials to
third-party services, public page and domain tokens, secret URLs (a webhook, a
private calendar feed). What a sync rebuilds (a cache), a pairing code, a lock
or a global corpus shared by every account is skipped with its reason.
Everything the account created is exported.

The host checks your declaration at boot against the real schema: a table or a
column that does not exist, a column ending in `_enc` that is neither `sealed`
nor `omit`, or a column named like a secret (`secret`, `token`, `passw`,
`_hash`, `private_key`, `credential`, `wrapped`) that is neither `omit` nor
`keep` stops the boot. `keep` is for a column that only looks like a secret (a
dedup hash).

## Files and shaped rows

For what is not a table row (the files you store) or needs shaping, declare
the table `'custom'` and write it from a hook:

```ts
accountExport: {
    tables: { ft_demo_files: 'custom' },
    files: {
        blobs: {
            label: 'les fichiers de Démo',
            optional: true,
            bytes: async ({ q, workspaceIds }) => sumOfSizes(q, workspaceIds)
        }
    },
    async workspace(ctx) {
        await ctx.out.table('ft_demo_files', {
            file: 'files.json',
            where: 'workspace_id = ?',
            key: ['id']
        });
        if (!ctx.includes('blobs')) return;
        for (const file of await ctx.repo.files(ctx.workspace.id)) {
            if (ctx.signal.aborted) return;
            await ctx.out.file(`Fichiers/${file.name}`, readStream(file), { mtime: file.mtime, compress: false });
        }
    }
}
```

- `files` are measured before the export, so the dialog can say what the
  archive weighs; an `optional` part may be left out by the holder.
- `ctx.out` writes under your folder: `json`, `rows` (streamed as a JSON array),
  `table` (a declared table, as the host would) and `file` (bytes or a stream;
  `compress: false` for what is already compressed).
- `ctx.cipher('private')` and `ctx.open(blob)` read both tiers for the length of
  the export. Check `ctx.signal.aborted` in long loops: the holder may stop the
  download.
- A hook that throws is reported in the archive and the other features go on.

In tests, check your declaration with `accountExportProblem(serverEntry.accountExport!)`
(from `@deveye/types/sdk/server`), which must be `null`.
