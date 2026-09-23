import { query } from "@/lib/db";

export type Recollection = {
  id: string;
  memoryId: string;
  memoryTitle: string | null;
  story: string | null;
  ageAtMemory: string | null;
  contributor: string;
  contributorId: string;
  status: "draft" | "pending" | "approved" | "rejected";
  hasVoice: boolean;
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): Recollection {
  return {
    id: String(row.id),
    memoryId: String(row.memory_id),
    memoryTitle: row.memory_title ? String(row.memory_title) : null,
    story: row.story ? String(row.story) : null,
    ageAtMemory: row.age_at_memory ? String(row.age_at_memory) : null,
    contributor: String(row.contributor),
    contributorId: String(row.contributed_by),
    status: row.status as Recollection["status"],
    hasVoice: Boolean(row.voice_storage_path),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function listApprovedRecollections(memoryId: string) {
  const result = await query(
    `SELECT
       r.id,
       r.memory_id,
       r.story,
       r.age_at_memory,
       r.contributed_by,
       r.status,
       r.voice_storage_path,
       r.created_at,
       u.display_name AS contributor
     FROM recollections r
     JOIN users u ON u.id = r.contributed_by
     WHERE r.memory_id = $1
       AND r.status = 'approved'
     ORDER BY r.created_at ASC`,
    [memoryId]
  );

  return result.rows.map((row) => mapRow(row));
}

export async function listPendingRecollections() {
  const result = await query(
    `SELECT
       r.id,
       r.memory_id,
       m.title AS memory_title,
       r.story,
       r.age_at_memory,
       r.contributed_by,
       r.status,
       r.voice_storage_path,
       r.created_at,
       u.display_name AS contributor
     FROM recollections r
     JOIN users u ON u.id = r.contributed_by
     JOIN memories m ON m.id = r.memory_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC`
  );

  return result.rows.map((row) => mapRow(row));
}
