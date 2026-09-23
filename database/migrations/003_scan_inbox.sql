ALTER TABLE media
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  storage_path text UNIQUE NOT NULL,
  mime_type text NOT NULL,
  bytes bigint NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'curated', 'skipped')),
  curated_memory_id uuid REFERENCES memories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_items_batch_idx
  ON import_items(batch_id, status, sort_order);

CREATE INDEX import_items_curated_memory_idx
  ON import_items(curated_memory_id);
