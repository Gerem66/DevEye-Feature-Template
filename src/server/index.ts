import type { FeatureServer } from 'deveye-types/sdk/server';

import { countdownHandlers } from './handlers';
import { createService } from './service';

/**
 * The server entry DevEye's generated glue imports.
 *
 * This feature stores everything in the KV store, so it declares no
 * `migrationsDir` and no `createRepo`. A feature with its own tables would add
 * both: SQL files under `src/server/migrations/` (local numbering, tables
 * prefixed `ft_<slug>_`) and a repo factory receiving a query handle.
 */
export const serverEntry: FeatureServer = {
    features: countdownHandlers,
    createService
};
