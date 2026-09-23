CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users ((lower(email)));

CREATE UNIQUE INDEX IF NOT EXISTS people_name_lower_idx
  ON people ((lower(display_name)));

CREATE UNIQUE INDEX IF NOT EXISTS media_storage_path_idx
  ON media(storage_path);
