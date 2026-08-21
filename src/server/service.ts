import type { FeatureService, FeatureServiceDeps } from 'deveye-types/sdk/server';

import { countdownListSchema, countdownSettingsSchema, DEFAULT_SETTINGS } from '../contracts/domain';

const LIST_KEY = 'countdowns';
const SETTINGS_KEY = 'settings';
const TICK_MS = 60_000;

/**
 * The background worker: every minute, notify the deadlines that just landed.
 *
 * Note what this code CANNOT do: read a `'private'` value. The service runs
 * with no user session, so its store only ever resolves the server-readable
 * tier; if your scheduler needs a value, store it with the default encryption.
 */
export function createService(deps: FeatureServiceDeps): FeatureService {
    return deps.createTicker({
        intervalMs: TICK_MS,
        async tick() {
            const now = Math.floor(Date.now() / 1000);
            for (const workspaceId of await deps.listWorkspaceIds()) {
                const store = deps.storeFor(workspaceId);
                const list = (await store.getJson(LIST_KEY, countdownListSchema)) ?? [];
                const settings = (await store.getJson(SETTINGS_KEY, countdownSettingsSchema)) ?? DEFAULT_SETTINGS;
                const due = list.filter((c) => !c.notified && c.at - settings.leadMinutes * 60 <= now);
                if (due.length === 0) continue;

                const notify = deps.deveyeFor(workspaceId).notify;
                for (const c of due) {
                    // No route configured = nothing to send; still mark it, a
                    // deadline only lands once.
                    await notify.send({
                        subject: `Deadline: ${c.label}`,
                        body: `"${c.label}" is due.`,
                        payload: { feature: 'x-countdown', id: c.id, at: c.at }
                    });
                }
                await store.putJson(
                    LIST_KEY,
                    countdownListSchema,
                    list.map((c) => (due.some((d) => d.id === c.id) ? { ...c, notified: true } : c))
                );
            }
        }
    });
}
