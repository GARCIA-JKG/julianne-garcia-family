ALTER TABLE media
  ADD COLUMN IF NOT EXISTS rotation_degrees integer NOT NULL DEFAULT 0
  CHECK (rotation_degrees IN (0, 90, 180, 270));

ALTER TABLE import_items
  ADD COLUMN IF NOT EXISTS rotation_degrees integer NOT NULL DEFAULT 0
  CHECK (rotation_degrees IN (0, 90, 180, 270));
