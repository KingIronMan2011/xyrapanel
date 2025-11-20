CREATE TABLE password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX password_resets_user_id_index ON password_resets(user_id);
CREATE INDEX password_resets_token_index ON password_resets(token);
