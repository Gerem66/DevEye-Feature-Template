import type { SdkQueryable } from '@deveye/types/sdk/server';

/**
 * A repo over your OWN tables — the starter for a feature that outgrows the KV
 * store. Counter does not use it: nothing wires it yet, and `server/index.ts`
 * says in one comment which two lines turn it on. Delete this file, the
 * `migrations/` folder and `uninstall.sql` if your feature stores nothing
 * relational.
 *
 * Three rules the app's own repos follow, and that the SDK relies on:
 *
 *  1. **Every table carries your `ft_<slug>_` prefix.** Checked by this repo's
 *     CI and again by DevEye at install time.
 *  2. **Filter by `workspace_id` in every query, yourself.** The handle is
 *     deliberately workspace-unaware: nothing here scopes for you.
 *  3. **A repo never encrypts.** It receives blobs the handler already sealed
 *     with `ctx.cipher()`, and hands them back sealed.
 */

/** One row, as SQL holds it: snake_case columns, the sealed blob included. */
export interface NoteRow {
    id: number;
    workspace_id: number;
    /** Sealed by the handler. The repo never looks inside. */
    content_enc: string;
    /** Epoch seconds, like everywhere in DevEye. */
    created: number;
}

export interface CounterRepo {
    list(workspaceId: number): Promise<NoteRow[]>;
    insert(workspaceId: number, contentEnc: string, at: number): Promise<number>;
    remove(id: number, workspaceId: number): Promise<boolean>;
}

export function counterRepo(q: SdkQueryable): CounterRepo {
    return {
        async list(workspaceId) {
            return q.query<NoteRow>('SELECT * FROM ft_counter_notes WHERE workspace_id = ? ORDER BY id DESC', [
                workspaceId
            ]);
        },
        async insert(workspaceId, contentEnc, at) {
            const res = await q.execute(
                'INSERT INTO ft_counter_notes (workspace_id, content_enc, created) VALUES (?, ?, ?)',
                [workspaceId, contentEnc, at]
            );
            return res.insertId;
        },
        async remove(id, workspaceId) {
            // The workspace goes in the WHERE clause, not in a check above it:
            // one query that cannot delete another workspace's row.
            const res = await q.execute('DELETE FROM ft_counter_notes WHERE id = ? AND workspace_id = ?', [
                id,
                workspaceId
            ]);
            return res.affectedRows > 0;
        }
    };
}
