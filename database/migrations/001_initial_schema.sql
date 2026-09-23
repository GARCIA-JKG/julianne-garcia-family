CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'curator', 'family', 'viewer');
CREATE TYPE memory_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE media_kind AS ENUM ('photo', 'video', 'audio');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'family',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  birth_date date,
  death_date date,
  biography text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  story text,
  memory_date date,
  approximate_date_label text,
  place_name text,
  status memory_status NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  kind media_kind NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  derivative_path text,
  mime_type text,
  bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  caption text,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memory_people (
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, person_id)
);

CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_media_id uuid REFERENCES media(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE album_memories (
  album_id uuid REFERENCES albums(id) ON DELETE CASCADE,
  memory_id uuid REFERENCES memories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, memory_id)
);

CREATE INDEX memories_status_idx ON memories(status);
CREATE INDEX memories_date_idx ON memories(memory_date);
CREATE INDEX media_memory_idx ON media(memory_id);
CREATE INDEX media_kind_idx ON media(kind);
