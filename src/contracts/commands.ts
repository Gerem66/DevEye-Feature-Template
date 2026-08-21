import { z } from 'zod';

import { COUNTDOWN_LABEL_MAX, countdownSchema, countdownSettingsSchema } from './domain';

/**
 * The WebSocket commands your feature handles. Every command name MUST start
 * with your feature id followed by a dot; the same convention names the
 * resource keys the client caches (see the manifest).
 */

export const countdownList = {
    command: 'x-countdown.list' as const,
    input: z.object({}),
    output: z.object({ countdowns: z.array(countdownSchema), settings: countdownSettingsSchema })
};

export const countdownAdd = {
    command: 'x-countdown.add' as const,
    input: z.object({
        label: z.string().min(1).max(COUNTDOWN_LABEL_MAX),
        at: z.number().int().positive()
    }),
    output: z.object({ countdown: countdownSchema })
};

export const countdownRemove = {
    command: 'x-countdown.remove' as const,
    input: z.object({ id: z.uuid() }),
    output: z.object({ id: z.uuid() })
};

/** The private note: stored with `encryption: 'private'`, read back on demand. */
export const countdownNoteGet = {
    command: 'x-countdown.noteGet' as const,
    input: z.object({ id: z.uuid() }),
    output: z.object({ note: z.string().nullable() })
};

export const countdownNoteSet = {
    command: 'x-countdown.noteSet' as const,
    input: z.object({ id: z.uuid(), note: z.string().max(2000) }),
    output: z.object({ id: z.uuid() })
};

export const countdownSettingsSet = {
    command: 'x-countdown.settingsSet' as const,
    input: countdownSettingsSchema,
    output: countdownSettingsSchema
};

export const countdownCommands = [
    countdownList,
    countdownAdd,
    countdownRemove,
    countdownNoteGet,
    countdownNoteSet,
    countdownSettingsSet
] as const;
