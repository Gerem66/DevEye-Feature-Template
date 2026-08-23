# DevEye Feature Template

Build your own [DevEye](https://github.com/Gerem66/DevEye) feature: a card on
the home grid, a full view, settings in the shared shell, permissions in
workspace roles, storage with encryption in one argument, notifications, live
presence. This repository is a working example feature, **Counter**, meant to
be renamed into yours.

## Quick start (10 minutes)

1. Click **Use this template** on GitHub and clone your copy.
2. Pick your feature's slug and rename the example:
   ```bash
   npx tsx scripts/rename.ts myfeature     # id becomes x-myfeature
   ```
3. Install and check (needs a GitHub token for the types package, see
   `.npmrc.example`):
   ```bash
   npm install
   npm run ci        # lint + typecheck + manifest validation + handler tests
   ```
4. Install it into a DevEye instance (you need a checkout of the app):
   ```bash
   # in the DevEye repo
   npm install <path-or-name-of-your-package>
   #   add { "package": "deveye-feature-myfeature" } to features.config.json
   npm run gen:features
   npm run dev
   ```
   Your card appears in the home grid's add market. That is the whole
   integration: one config entry, one generated-glue run.

## Anatomy

```
deveye-feature.json      build metadata: id, table allowlist, shipped icons
assets/icons/            monochrome SVGs; DevEye namespaces and serves them
src/
├── index.ts             isomorphic entry: manifest + contracts only
├── manifest.ts          THE declaration: everything DevEye knows about you
├── contracts/           zod schemas: entities and commands
├── server/
│   ├── index.ts         serverEntry: handlers (+ optional repo, migrations, service)
│   ├── handlers.ts      one handler per command, SDK context
│   └── handlers.test.ts node:test against the in-memory harness
└── client/
    ├── index.tsx        clientEntry: Widget, Full view, settings panels
    ├── Counter.tsx      the components, on `deveye-sdk-client`
    ├── GeneralPanel.tsx a settings tab panel
    └── style.module.css scoped styles on DevEye's design tokens
```

## The rules that matter

- **Your id prefixes everything.** Feature id `x-myfeature`, commands
  `x-myfeature.<verb>`, resource keys `x-myfeature.<name>`, tables
  `ft_myfeature_*`. The prefix is what makes collisions impossible; both this
  repo's CI and DevEye's install step enforce it. It also bounds a clean
  uninstall: if you ship migrations, ship their destructive mirror
  `src/server/uninstall.sql` too (see
  [docs/04-storage-and-encryption.md](docs/04-storage-and-encryption.md)).
- **The server authorizes, the UI hides.** Declare `access` on each command
  (read/write level plus your own `extraPermissions`); the dispatcher enforces
  it before your handler runs. Client checks are cosmetics.
- **Encryption is one argument.** `ctx.store.put(key, value)` is encrypted and
  server-readable (right for API keys and anything a background job reads);
  `{ encryption: 'private' }` is for user secrets and never readable outside an
  unlocked session; `'none'` is for plain metadata. See
  [docs/04-storage-and-encryption.md](docs/04-storage-and-encryption.md).
- **No polling.** Declare `mutates: true` on writing commands and list your
  resource keys in the manifest: every member's client re-fetches when anyone
  writes. See [docs/05-client.md](docs/05-client.md).

## Documentation

| Doc | What |
|---|---|
| [01-concepts](docs/01-concepts.md) | the one-page map: workspaces, roles, commands, topics |
| [02-manifest](docs/02-manifest.md) | every manifest field, annotated |
| [03-server-handlers](docs/03-server-handlers.md) | handlers, context, errors, testing |
| [04-storage-and-encryption](docs/04-storage-and-encryption.md) | KV store, own tables, the three modes |
| [05-client](docs/05-client.md) | widget, view, data hook, typed commands |
| [06-settings-panels](docs/06-settings-panels.md) | tabs and panels in the shared shell |
| [07-permissions](docs/07-permissions.md) | read/write, channels, your own extras |
| [08-notifications](docs/08-notifications.md) | sending through the workspace's channels |
| [09-live](docs/09-live.md) | presence, outlines, teleport |
| [10-background-services](docs/10-background-services.md) | the ticker, and its limits |
| [11-cookbook](docs/11-cookbook.md) | task-shaped recipes |
| [REFERENCE](docs/REFERENCE.md) | the API surface, type by type |

## The living native examples

DevEye's own features are being migrated onto this exact contract, inside the
main repo, and the app's CI keeps them current. When a doc here feels
abstract, read them:

- `features/weather/` — the simple shape: one screen, a shared store, a
  topbar mini-widget, provider API keys in a Sources panel.
- `features/osint/` — the richer shape: several client components, a 30s
  command timeout (`featureApi` third argument), password-based encryption on
  reads (`useSecrecy` / `withSecrecy`), and handler tests on the in-memory
  harness (`src/server/handlers.test.ts`).
