CREATE TABLE recollections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  contributed_by uuid NOT NULL REFERENCES users(id),
  story text,
  age_at_memory text,
  status memory_status NOT NULL DEFAULT 'pending',
  voice_original_filename text,
  voice_storage_path text UNIQUE,
  voice_mime_type text,
  voice_bytes bigint,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (story IS NOT NULL AND length(trim(story)) > 0)
    OR voice_storage_path IS NOT NULL
  )
);

CREATE INDEX recollections_memory_idx
  ON recollections(memory_id, status, created_at);

CREATE INDEX recollections_status_idx
  ON recollections(status, created_at);
