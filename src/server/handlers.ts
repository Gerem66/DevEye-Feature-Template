import { randomUUID } from 'node:crypto';

import { defineSdkFeature, FeatureError, type FeatureStore, type SdkFeatureContext } from 'deveye-types/sdk/server';

import {
    countdownAdd,
    countdownList,
    countdownNoteGet,
    countdownNoteSet,
    countdownRemove,
    countdownSettingsSet
} from '../contracts/commands';
import { countdownListSchema, countdownSettingsSchema, DEFAULT_SETTINGS, type StoredCountdown } from '../contracts/domain';

/**
 * Handlers: one per command. The dispatcher has already validated the input,
 * checked the caller's access on YOUR feature (plus any `extras` you declare),
 * and resolved the workspace; you receive a ready-to-use context.
 *
 * Storage here is the KV store: no table, no migration, encryption in one
 * argument. The list itself is `'server'` (default: encrypted, readable by the
 * background ticker); each private note is `'private'` (readable only inside
 * an unlocked user session).
 */

const LIST_KEY = 'countdowns';
const SETTINGS_KEY = 'settings';
const noteKey = (id: string): string => `note:${id}`;

export async function readList(store: FeatureStore): Promise<StoredCountdown[]> {
    return (await store.getJson(LIST_KEY, countdownListSchema)) ?? [];
}

export const countdownHandlers = [
    defineSdkFeature({
        ...countdownList,
        handler: async (ctx: SdkFeatureContext) => {
            const stored = await readList(ctx.store);
            const countdowns = await Promise.all(
                stored.map(async (c) => ({ ...c, hasNote: (await ctx.store.get(noteKey(c.id))) !== null }))
            );
            const settings = (await ctx.store.getJson(SETTINGS_KEY, countdownSettingsSchema)) ?? DEFAULT_SETTINGS;
            return { countdowns, settings };
        }
    }),
    defineSdkFeature({
        ...countdownAdd,
        access: { level: 'write', extras: ['manageDeadlines'] },
        mutates: true,
        handler: async (ctx: SdkFeatureContext, input) => {
            const list = await readList(ctx.store);
            const countdown: StoredCountdown = { id: randomUUID(), label: input.label, at: input.at, notified: false };
            await ctx.store.putJson(LIST_KEY, countdownListSchema, [...list, countdown]);
            ctx.audit({ action: 'x-countdown.add', description: `Deadline added: "${input.label}"` });
            return { countdown: { ...countdown, hasNote: false } };
        }
    }),
    defineSdkFeature({
        ...countdownRemove,
        access: { level: 'write', extras: ['manageDeadlines'] },
        mutates: true,
        handler: async (ctx: SdkFeatureContext, input) => {
            const list = await readList(ctx.store);
            if (!list.some((c) => c.id === input.id)) throw new FeatureError('not_found', 'Deadline not found');
            await ctx.store.putJson(LIST_KEY, countdownListSchema, list.filter((c) => c.id !== input.id));
            await ctx.store.remove(noteKey(input.id));
            return { id: input.id };
        }
    }),
    defineSdkFeature({
        ...countdownNoteGet,
        handler: async (ctx: SdkFeatureContext, input) => {
            // A 'private' read can throw `locked` (session sealed) or
            // `forbidden` (foreign caller): let it surface, the client copes.
            return { note: await ctx.store.get(noteKey(input.id)) };
        }
    }),
    defineSdkFeature({
        ...countdownNoteSet,
        access: { level: 'write' },
        mutates: true,
        handler: async (ctx: SdkFeatureContext, input) => {
            if (input.note.trim().length === 0) await ctx.store.remove(noteKey(input.id));
            else await ctx.store.put(noteKey(input.id), input.note, { encryption: 'private' });
            return { id: input.id };
        }
    }),
    defineSdkFeature({
        ...countdownSettingsSet,
        access: { level: 'write' },
        mutates: true,
        handler: async (ctx: SdkFeatureContext, input) => {
            await ctx.store.putJson(SETTINGS_KEY, countdownSettingsSchema, input);
            return input;
        }
    })
];
