ALTER TABLE media
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz,
  ADD COLUMN IF NOT EXISTS trashed_by uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS media_trashed_at_idx
  ON media(trashed_at)
  WHERE trashed_at IS NOT NULL;
