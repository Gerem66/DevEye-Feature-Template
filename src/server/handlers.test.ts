import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTestContext } from 'deveye-types/sdk/testing';

import { countdownHandlers } from './handlers';

/**
 * Handler tests run against the in-memory test context: no app, no database,
 * no socket. `ctx.recorded` captures notifications and audit lines.
 */

// The array element type is a union of concrete definitions; calling through
// it would intersect the input types. Tests address handlers loosely: the
// runtime (and each handler's own typing) is what is under test.
const byName = (name: string) => {
    const def = countdownHandlers.find((h) => h.command === name);
    if (!def) throw new Error(`no handler ${name}`);
    return def as unknown as { handler: (ctx: unknown, input: unknown) => Promise<unknown> };
};

describe('x-countdown handlers', () => {
    it('adds then lists a deadline', async () => {
        const ctx = createTestContext();
        const added = (await byName('x-countdown.add').handler(ctx, { label: 'Demo day', at: 2_000_000_000 })) as {
            countdown: { id: string; label: string };
        };
        assert.equal(added.countdown.label, 'Demo day');

        const listed = (await byName('x-countdown.list').handler(ctx, {})) as { countdowns: { id: string }[] };
        assert.equal(listed.countdowns.length, 1);
        assert.equal(listed.countdowns[0].id, added.countdown.id);
    });

    it('stores the private note privately and reports hasNote', async () => {
        const ctx = createTestContext();
        const added = (await byName('x-countdown.add').handler(ctx, { label: 'X', at: 2_000_000_000 })) as {
            countdown: { id: string };
        };
        await byName('x-countdown.noteSet').handler(ctx, { id: added.countdown.id, note: 'secret' });

        const row = ctx.store.rows?.get?.(`note:${added.countdown.id}`) as { mode: string } | undefined;
        assert.equal(row?.mode, 'private');

        const listed = (await byName('x-countdown.list').handler(ctx, {})) as { countdowns: { hasNote: boolean }[] };
        assert.equal(listed.countdowns[0].hasNote, true);
    });
});
