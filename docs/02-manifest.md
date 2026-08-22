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
| `shareTier` | must be `'never'` for external modules for now |
| `tile.compact` | half-height card, like device tiles |
| `topbarWidget` | offers your `TopbarWidget` component in the navbar widget picker; `description` is its subtitle there |
| `resources` | the client cache keys your topic refreshes |
| `invalidatedByTopic` | subset of `resources` refreshed on broadcast (default: all) |
| `itemSegment` | builds the live/teleport segment of one item, e.g. `` (id) => `job:${id}` `` |
| `settings` | which tabs exist, per scope; see [06-settings-panels](06-settings-panels.md) |
| `extraPermissions` | your own permissions in the role editor; see [07-permissions](07-permissions.md) |
| `nativeCapabilities` | which `ctx.deveye` facades you may call; undeclared calls throw |
| `commands` | your zod contracts; every name must start with `<id>.` |

## Validation

`validateManifest(manifest)` runs three times: in this repo's CI
(`npm run validate`), at install time (`npm run gen:features` in DevEye), and
at the app's boot. The same violation fails in the same words at each fence;
you will simply meet it at the earliest one.

## What stays out of the manifest

Anything executable for the app: your components live in the client entry,
your handlers in the server entry. The manifest is data (plus the optional
`itemSegment` function), so both bundles can load it without dragging the
other's world in.
