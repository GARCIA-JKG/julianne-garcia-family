import { query } from "@/lib/db";

export type ScanBatch = {
  id: string;
  name: string;
  source: string | null;
  notes: string | null;
  createdAt: string;
  total: number;
  pending: number;
  curated: number;
};

export type ScanItem = {
  id: string;
  originalFilename: string;
  mimeType: string;
  bytes: number;
  sortOrder: number;
  rotationDegrees: number;
  status: "pending" | "curated" | "skipped";
  curatedMemoryId: string | null;
};

export async function listScanBatches() {
  const result = await query<{
    id: string;
    name: string;
    source: string | null;
    notes: string | null;
    created_at: string;
    total: string;
    pending: string;
    curated: string;
  }>(
    `SELECT
       b.id,
       b.name,
       b.source,
       b.notes,
       b.created_at,
       count(i.id)::text AS total,
       count(i.id) FILTER (WHERE i.status = 'pending')::text AS pending,
       count(i.id) FILTER (WHERE i.status = 'curated')::text AS curated
     FROM import_batches b
     LEFT JOIN import_items i ON i.batch_id = b.id
     GROUP BY b.id
     ORDER BY b.created_at DESC`
  );

  return result.rows.map((row): ScanBatch => ({
    id: row.id,
    name: row.name,
    source: row.source,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    total: Number(row.total),
    pending: Number(row.pending),
    curated: Number(row.curated)
  }));
}

export async function getScanBatch(id: string) {
  const batch = await query<{
    id: string;
    name: string;
    source: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT id, name, source, notes, created_at
     FROM import_batches
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!batch.rows[0]) return null;

  const items = await query<{
    id: string;
    original_filename: string;
    mime_type: string;
    bytes: string;
    sort_order: number;
    rotation_degrees: number;
    status: ScanItem["status"];
    curated_memory_id: string | null;
  }>(
    `SELECT
       id,
       original_filename,
       mime_type,
       bytes::text,
       sort_order,
       rotation_degrees,
       status,
       curated_memory_id
     FROM import_items
     WHERE batch_id = $1
     ORDER BY sort_order, created_at`,
    [id]
  );

  return {
    id: batch.rows[0].id,
    name: batch.rows[0].name,
    source: batch.rows[0].source,
    notes: batch.rows[0].notes,
    createdAt: new Date(batch.rows[0].created_at).toISOString(),
    items: items.rows.map((row): ScanItem => ({
      id: row.id,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      bytes: Number(row.bytes),
      sortOrder: row.sort_order,
      rotationDegrees: row.rotation_degrees,
      status: row.status,
      curatedMemoryId: row.curated_memory_id
    }))
  };
}
