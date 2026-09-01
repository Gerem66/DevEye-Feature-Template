-- The starter migration. Numbered locally (001, 002...), applied in order and
-- recorded as `<feature-id>/<filename>`, AFTER every core migration.
--
-- Three traps that do not announce themselves:
--
--  1. **Never edit a migration once it has run somewhere.** The recorded name
--     is never replayed, so your edit is a silent no-op there while the file
--     and the database drift apart. A schema change is always a NEW number.
--  2. **No semicolon inside a SQL comment.** The runner splits statements on
--     semicolons, so one inside a comment cuts a statement in half.
--  3. **Migrations run at boot, without a transaction.** A file that fails
--     halfway leaves what it already did. Write each statement so replaying
--     the file is harmless, as `IF NOT EXISTS` does here.
--
-- Charset and collation are deliberately NOT pinned: the table inherits the
-- database default. Pin them only on a column you compare against a core
-- table's text column, and pin THAT column's collation, read from
-- INFORMATION_SCHEMA rather than written in by hand.

CREATE TABLE IF NOT EXISTS ft_counter_notes (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id INT    NOT NULL,
    -- Sealed by the handler with `ctx.cipher()`. Storage only ever sees blobs.
    content_enc  TEXT   NOT NULL,
    created      BIGINT NOT NULL,
    KEY idx_ft_counter_notes_workspace (workspace_id),
    -- The workspace goes away, its rows go with it. Without this, a deleted
    -- workspace leaves orphans no screen will ever show again.
    CONSTRAINT fk_ft_counter_notes_workspace FOREIGN KEY (workspace_id)
        REFERENCES workspaces (id) ON DELETE CASCADE
);
