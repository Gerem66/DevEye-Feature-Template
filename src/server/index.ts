import type { FeatureServer } from 'deveye-types/sdk/server';

import { counterHandlers } from './handlers';

/**
 * The server entry DevEye's generated glue imports.
 *
 * This feature stores everything in the KV store, so it declares no
 * `migrationsDir` and no `createRepo`. A feature with its own tables would add
 * both — SQL files under `src/server/migrations/` (local numbering, tables
 * prefixed `ft_<slug>_`, plus their destructive mirror `uninstall.sql`) and a
 * repo factory receiving a query handle. A feature with background work would
 * add `createService` (a `deps.createTicker` loop; note it runs sessionless —
 * see docs/10-background-services.md).
 */
export const serverEntry: FeatureServer = {
    features: counterHandlers
};
