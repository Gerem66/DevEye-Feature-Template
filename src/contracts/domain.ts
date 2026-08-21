import { z } from 'zod';

/**
 * Domain entities: the shapes your feature stores and shows.
 *
 * Keep zod as the single source of truth; every TypeScript type is inferred.
 * The server validates against these schemas in both directions, so a payload
 * that does not match never crosses the wire.
 */

export const COUNTDOWN_LABEL_MAX = 80;

export const countdownSchema = z.object({
    id: z.uuid(),
    label: z.string().min(1).max(COUNTDOWN_LABEL_MAX),
    /** Unix seconds. */
    at: z.number().int().positive(),
    /** Whether the deadline notification has already been sent. */
    notified: z.boolean(),
    /** The caller has a private note attached (its content never travels in lists). */
    hasNote: z.boolean()
});
export type Countdown = z.infer<typeof countdownSchema>;

/** What the KV store persists (see server/handlers.ts). */
export const countdownListSchema = z.array(countdownSchema.omit({ hasNote: true }));
export type StoredCountdown = z.infer<typeof countdownListSchema>[number];

/** Feature-level settings, edited in the General settings tab. */
export const countdownSettingsSchema = z.object({
    /** Minutes before the deadline at which the notification fires. */
    leadMinutes: z.number().int().min(0).max(7 * 24 * 60)
});
export type CountdownSettings = z.infer<typeof countdownSettingsSchema>;

export const DEFAULT_SETTINGS: CountdownSettings = { leadMinutes: 0 };
