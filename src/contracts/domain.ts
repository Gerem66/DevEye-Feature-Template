import { z } from 'zod';

/**
 * Domain entities: the shapes your feature stores and shows.
 *
 * Keep zod as the single source of truth; every TypeScript type is inferred.
 * The server validates against these schemas in both directions, so a payload
 * that does not match never crosses the wire.
 */

/** How many clicks the journal keeps. Older rows fall off the end. */
export const COUNTER_CLICKS_KEPT = 20;

/** Every this many, the increment sends a notification (see handlers). */
export const COUNTER_MILESTONE = 100;

/** How much one click adds. A closed set keeps the settings UI a three-way toggle. */
export const counterStepSchema = z.union([z.literal(1), z.literal(5), z.literal(10)]);
export type CounterStep = z.infer<typeof counterStepSchema>;

/**
 * One click, as the CLIENT sees it: the counter value it produced, twice.
 * `value` is decrypted server-side at read time; `sealed` is the very blob
 * sitting in storage — shown as-is, so the example makes encryption tangible.
 */
export const counterClickSchema = z.object({
    /** Unix milliseconds. */
    at: z.number().int().positive(),
    value: z.number().int().positive(),
    sealed: z.string().min(1)
});
export type CounterClick = z.infer<typeof counterClickSchema>;

/**
 * One click, as the KV store persists it: the ciphertext ONLY. The plain
 * column never touches storage — it is recomputed by decrypting on read,
 * which is exactly the pattern for a column you encrypt in your own tables.
 */
export const storedClicksSchema = z.array(counterClickSchema.omit({ value: true }));
export type StoredClick = z.infer<typeof storedClicksSchema>[number];

/** The whole feature state. Every command returns it: one shape, one cache key. */
export const counterStateSchema = z.object({
    value: z.number().int().nonnegative(),
    step: counterStepSchema,
    clicks: z.array(counterClickSchema).max(COUNTER_CLICKS_KEPT)
});
export type CounterState = z.infer<typeof counterStateSchema>;
