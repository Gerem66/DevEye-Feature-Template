import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTestContext } from '@deveye/types/sdk/testing';

import { COUNTER_CLICKS_KEPT, type CounterState } from '../contracts/domain';
import { counterHandlers } from './handlers';

/**
 * Handler tests run against the in-memory test context: no app, no database,
 * no socket. Its cipher is the identity function, which is a feature here:
 * `sealed` comes back equal to the plain value, so the seal-then-unseal wiring
 * is visible in plain assertions. `ctx.recorded` captures notifications and
 * audit lines.
 */

// The array element type is a union of concrete definitions; calling through
// it would intersect the input types. Tests address handlers loosely: the
// runtime (and each handler's own typing) is what is under test.
const byName = (name: string) => {
    const def = counterHandlers.find((h) => h.command === name);
    if (!def) throw new Error(`no handler ${name}`);
    return def as unknown as { handler: (ctx: unknown, input: unknown) => Promise<CounterState> };
};

describe('x-counter handlers', () => {
    it('increments server-side and journals the value sealed', async () => {
        const ctx = createTestContext();
        const state = await byName('x-counter.increment').handler(ctx, {});

        assert.equal(state.value, 1);
        assert.equal(state.clicks.length, 1);
        // Identity cipher: the blob IS the plain value, proving the plain
        // column travelled through encrypt() then tryDecrypt().
        assert.equal(state.clicks[0].sealed, '1');
        assert.equal(state.clicks[0].value, 1);

        // What storage holds is the sealed row ONLY: no plain `value` column.
        const stored = ctx.store.rows.get('clicks');
        assert.ok(stored && !stored.value.includes('"value"'));
    });

    it('honours the step and caps the journal', async () => {
        const ctx = createTestContext();
        await byName('x-counter.stepSet').handler(ctx, { step: 5 });
        let state: CounterState | undefined;
        for (let i = 0; i < COUNTER_CLICKS_KEPT + 5; i++) {
            state = await byName('x-counter.increment').handler(ctx, {});
        }
        assert.equal(state?.value, (COUNTER_CLICKS_KEPT + 5) * 5);
        assert.equal(state?.clicks.length, COUNTER_CLICKS_KEPT);
        // Newest first: the head of the journal is the latest value.
        assert.equal(state?.clicks[0].value, state?.value);
    });

    it('notifies when a milestone is crossed, once', async () => {
        const ctx = createTestContext();
        await byName('x-counter.stepSet').handler(ctx, { step: 10 });
        for (let i = 0; i < 10; i++) await byName('x-counter.increment').handler(ctx, {});

        assert.equal(ctx.recorded.notifications.length, 1);
        assert.match(ctx.recorded.notifications[0].subject, /100/);
    });

    it('resets value and journal, and leaves an audit line', async () => {
        const ctx = createTestContext();
        await byName('x-counter.increment').handler(ctx, {});
        const state = await byName('x-counter.reset').handler(ctx, {});

        assert.equal(state.value, 0);
        assert.equal(state.clicks.length, 0);
        assert.equal(ctx.recorded.audits.length, 1);
        assert.equal(ctx.recorded.audits[0].action, 'x-counter.reset');
    });
});
