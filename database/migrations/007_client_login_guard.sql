CREATE TABLE IF NOT EXISTS client_login_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  email_hash text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_login_attempts_ip_idx
  ON client_login_attempts(ip_hash, attempted_at DESC);

CREATE INDEX IF NOT EXISTS client_login_attempts_email_idx
  ON client_login_attempts(email_hash, attempted_at DESC);
