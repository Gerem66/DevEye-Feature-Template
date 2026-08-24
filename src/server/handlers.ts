import { z } from 'zod';

import { defineSdkFeature, type SdkFeatureContext } from '@deveye/types/sdk/server';

import { counterIncrement, counterReset, counterState, counterStepSet } from '../contracts/commands';
import {
    COUNTER_CLICKS_KEPT,
    COUNTER_MILESTONE,
    counterStepSchema,
    storedClicksSchema,
    type CounterState,
    type CounterStep,
    type StoredClick
} from '../contracts/domain';

/**
 * Handlers: one per command. The dispatcher has already validated the input,
 * checked the caller's access on YOUR feature (plus any `extras` you declare),
 * and resolved the workspace; you receive a ready-to-use context.
 *
 * Storage here is the KV store: no table, no migration. The twist this example
 * exists for: each click's value is stored ONCE, as a ciphertext produced by
 * `ctx.cipher()` — the plain column the client shows is recomputed by
 * DECRYPTING at read time. That is exactly how a sensitive column in your own
 * tables works: the handler seals before writing, unseals after reading, and
 * storage only ever sees blobs.
 */

const VALUE_KEY = 'value';
const STEP_KEY = 'step';
const CLICKS_KEY = 'clicks';

const valueSchema = z.number().int().nonnegative();

async function readStep(ctx: SdkFeatureContext): Promise<CounterStep> {
    return (await ctx.store.getJson(STEP_KEY, counterStepSchema)) ?? 1;
}

/** The full state, with the journal's plain column decrypted on the way out. */
async function readState(ctx: SdkFeatureContext): Promise<CounterState> {
    const value = (await ctx.store.getJson(VALUE_KEY, valueSchema)) ?? 0;
    const stored = (await ctx.store.getJson(CLICKS_KEY, storedClicksSchema)) ?? [];
    const clicks = [];
    for (const row of stored) {
        // `tryDecrypt`, not `decrypt`: a blob sealed under a previous server
        // key reads as null — that row is dropped, the screen never breaks.
        const plain = await ctx.cipher().tryDecrypt(row.sealed);
        if (plain !== null) clicks.push({ at: row.at, value: Number(plain), sealed: row.sealed });
    }
    return { value, step: await readStep(ctx), clicks };
}

export const counterHandlers = [
    defineSdkFeature({
        ...counterState,
        handler: async (ctx: SdkFeatureContext) => readState(ctx)
    }),
    defineSdkFeature({
        ...counterIncrement,
        access: { level: 'write' },
        mutates: true,
        handler: async (ctx: SdkFeatureContext) => {
            const previous = (await ctx.store.getJson(VALUE_KEY, valueSchema)) ?? 0;
            const value = previous + (await readStep(ctx));

            // The demo's heart: seal the value BY HAND, store only the blob.
            // (The KV store can also encrypt transparently — pass
            // `{ encryption: 'server' }` — but then you would never SEE a
            // ciphertext, which is the whole point of this journal.)
            const sealed = await ctx.cipher().encrypt(String(value));
            const stored = (await ctx.store.getJson(CLICKS_KEY, storedClicksSchema)) ?? [];
            const clicks: StoredClick[] = [{ at: Date.now(), sealed }, ...stored].slice(0, COUNTER_CLICKS_KEPT);

            // The counter itself is plain metadata: 'none' keeps it readable
            // in SQL, and there is nothing to hide about a click count.
            await ctx.store.putJson(VALUE_KEY, valueSchema, value, { encryption: 'none' });
            await ctx.store.putJson(CLICKS_KEY, storedClicksSchema, clicks, { encryption: 'none' });

            // A milestone crossed: notify through the channels the workspace
            // routed to this feature (capability 'notify' in the manifest).
            if (Math.floor(value / COUNTER_MILESTONE) > Math.floor(previous / COUNTER_MILESTONE)) {
                const milestone = Math.floor(value / COUNTER_MILESTONE) * COUNTER_MILESTONE;
                await ctx.deveye.notify.send({
                    subject: `Compteur : ${milestone} atteint`,
                    body: `Le compteur vient de passer ${milestone} (valeur : ${value}).`,
                    payload: { feature: 'x-counter', value }
                });
            }

            return readState(ctx);
        }
    }),
    defineSdkFeature({
        ...counterReset,
        // `extras`: ALL listed keys are required on top of the level. The
        // dispatcher enforces them before this handler runs; the UI only hides.
        access: { level: 'write', extras: ['reset'] },
        mutates: true,
        handler: async (ctx: SdkFeatureContext) => {
            const value = (await ctx.store.getJson(VALUE_KEY, valueSchema)) ?? 0;
            await ctx.store.putJson(VALUE_KEY, valueSchema, 0, { encryption: 'none' });
            await ctx.store.putJson(CLICKS_KEY, storedClicksSchema, [], { encryption: 'none' });
            // Destructive and silent afterwards: exactly what the audit log is for.
            ctx.audit({ action: 'x-counter.reset', description: `Compteur remis à zéro (valeur : ${value})` });
            return readState(ctx);
        }
    }),
    defineSdkFeature({
        ...counterStepSet,
        access: { level: 'write' },
        mutates: true,
        handler: async (ctx: SdkFeatureContext, input) => {
            await ctx.store.putJson(STEP_KEY, counterStepSchema, input.step, { encryption: 'none' });
            return readState(ctx);
        }
    })
];
