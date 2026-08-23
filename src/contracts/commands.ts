import { z } from 'zod';

import { counterStateSchema, counterStepSchema } from './domain';

/**
 * The WebSocket commands your feature handles. Every command name MUST start
 * with your feature id followed by a dot; the same convention names the
 * resource keys the client caches (see the manifest).
 *
 * All four commands answer with the full state: one output shape means one
 * cache key, and every screen (card, full view, settings panel) stays in
 * step for free.
 */

export const counterState = {
    command: 'x-counter.state' as const,
    input: z.object({}),
    output: counterStateSchema
};

/** THE button. No input: the increment amount is workspace state, not caller choice. */
export const counterIncrement = {
    command: 'x-counter.increment' as const,
    input: z.object({}),
    output: counterStateSchema
};

/** Gated by the `reset` extra permission (see the manifest). */
export const counterReset = {
    command: 'x-counter.reset' as const,
    input: z.object({}),
    output: counterStateSchema
};

export const counterStepSet = {
    command: 'x-counter.stepSet' as const,
    input: z.object({ step: counterStepSchema }),
    output: counterStateSchema
};

export const counterCommands = [counterState, counterIncrement, counterReset, counterStepSet] as const;
