ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS memory_year integer,
  ADD COLUMN IF NOT EXISTS memory_month integer,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE memories
  DROP CONSTRAINT IF EXISTS memories_month_check;

ALTER TABLE memories
  ADD CONSTRAINT memories_month_check
  CHECK (memory_month IS NULL OR memory_month BETWEEN 1 AND 12);

ALTER TABLE memories
  DROP CONSTRAINT IF EXISTS memories_year_check;

ALTER TABLE memories
  ADD CONSTRAINT memories_year_check
  CHECK (memory_year IS NULL OR memory_year BETWEEN 1000 AND 2200);

CREATE TABLE IF NOT EXISTS geocoded_places (
  normalized_query text PRIMARY KEY,
  display_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_geo_idx
  ON memories(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
