ALTER TABLE media
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_month integer,
  ADD COLUMN IF NOT EXISTS death_year integer,
  ADD COLUMN IF NOT EXISTS death_month integer,
  ADD COLUMN IF NOT EXISTS birth_place text;

ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_birth_month_check;

ALTER TABLE people
  ADD CONSTRAINT people_birth_month_check
  CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12);

ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_death_month_check;

ALTER TABLE people
  ADD CONSTRAINT people_death_month_check
  CHECK (death_month IS NULL OR death_month BETWEEN 1 AND 12);

ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_birth_year_check;

ALTER TABLE people
  ADD CONSTRAINT people_birth_year_check
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1000 AND 2200);

ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_death_year_check;

ALTER TABLE people
  ADD CONSTRAINT people_death_year_check
  CHECK (death_year IS NULL OR death_year BETWEEN 1000 AND 2200);

CREATE TABLE IF NOT EXISTS person_relationships (
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, related_person_id, relationship_label),
  CHECK (person_id <> related_person_id)
);

CREATE INDEX IF NOT EXISTS person_relationships_person_idx
  ON person_relationships(person_id);

CREATE TABLE IF NOT EXISTS memory_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES users(id),
  change_summary text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_edits_memory_idx
  ON memory_edits(memory_id, created_at DESC);
