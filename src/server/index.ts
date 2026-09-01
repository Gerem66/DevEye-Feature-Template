import type { FeatureServer } from '@deveye/types/sdk/server';

import { counterHandlers } from './handlers';

/**
 * The server entry DevEye's generated glue imports.
 *
 * Counter stores everything in the KV store, so what it declares is the
 * minimum: its handlers. The three things a bigger feature adds are already
 * written next door, inert, so you turn them on by uncommenting rather than by
 * inventing them:
 *
 *  - **Your own tables**: `migrations/001_example.sql` (plus its destructive
 *    mirror `uninstall.sql`) and the repo factory in `repo.ts`. Uncomment
 *    `createRepo` and `migrationsDir` below, and `ctx.repo` is typed in every
 *    handler.
 *  - **Background work**: a `createService(deps)` returning
 *    `deps.createTicker({ intervalMs, tick })`. It runs SESSIONLESS: no
 *    caller, no guarded cipher, no `'private'` data — see
 *    docs/10-background-services.md.
 *  - **Items the app must name without opening you** (`items`), required as
 *    soon as `shareTier` is not `'never'`.
 *
 * Delete `repo.ts`, `migrations/` and `uninstall.sql` if your feature stores
 * nothing relational: an unused table is a schema everyone has to explain.
 */
export const serverEntry: FeatureServer = {
    features: counterHandlers
    // createRepo: counterRepo,
    // migrationsDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
    // createService: (deps) => deps.createTicker({ intervalMs: 60_000, tick: async () => {} })
};
