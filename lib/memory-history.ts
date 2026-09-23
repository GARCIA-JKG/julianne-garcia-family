import { query } from "@/lib/db";

export async function captureMemorySnapshot(
  memoryId: string,
  changedBy: string,
  summary: string
) {
  const snapshot = await query(
    `SELECT jsonb_build_object(
       'memory', to_jsonb(m),
       'people', COALESCE(
         (
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', p.id,
               'display_name', p.display_name
             )
             ORDER BY p.display_name
           )
           FROM memory_people mp
           JOIN people p ON p.id = mp.person_id
           WHERE mp.memory_id = m.id
         ),
         '[]'::jsonb
       ),
       'media', COALESCE(
         (
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', md.id,
               'kind', md.kind,
               'original_filename', md.original_filename,
               'caption', md.caption,
               'sort_order', md.sort_order
             )
             ORDER BY md.sort_order, md.created_at
           )
           FROM media md
           WHERE md.memory_id = m.id
         ),
         '[]'::jsonb
       )
     ) AS snapshot
     FROM memories m
     WHERE m.id = $1`,
    [memoryId]
  );

  if (!snapshot.rows[0]?.snapshot) return;

  await query(
    `INSERT INTO memory_edits (
       memory_id,
       changed_by,
       change_summary,
       snapshot
     )
     VALUES ($1, $2, $3, $4)`,
    [
      memoryId,
      changedBy,
      summary.slice(0, 240),
      snapshot.rows[0].snapshot
    ]
  );
}

export async function listMemoryHistory(memoryId: string) {
  const result = await query<{
    id: string;
    change_summary: string;
    created_at: string;
    display_name: string;
  }>(
    `SELECT
       e.id,
       e.change_summary,
       e.created_at,
       u.display_name
     FROM memory_edits e
     JOIN users u ON u.id = e.changed_by
     WHERE e.memory_id = $1
     ORDER BY e.created_at DESC
     LIMIT 50`,
    [memoryId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    summary: row.change_summary,
    changedBy: row.display_name,
    createdAt: new Date(row.created_at).toISOString()
  }));
}
