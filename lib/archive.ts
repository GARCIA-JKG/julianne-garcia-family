import type { CurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export type MediaItem = {
  id: string;
  kind: "photo" | "video" | "audio";
  originalFilename: string;
  mimeType: string | null;
  caption: string | null;
};

export type ArchiveMemory = {
  id: string;
  title: string;
  story: string | null;
  dateLabel: string | null;
  place: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  contributor: string | null;
  createdBy: string | null;
  people: string[];
  media: MediaItem[];
  createdAt: string;
};

const memorySelect = `
  SELECT
    m.id,
    m.title,
    m.story,
    COALESCE(m.approximate_date_label, to_char(m.memory_date, 'YYYY-MM-DD')) AS date_label,
    m.place_name,
    m.status,
    m.created_by,
    m.created_at,
    u.display_name AS contributor,
    COALESCE(
      (
        SELECT json_agg(p.display_name ORDER BY p.display_name)
        FROM memory_people mp
        JOIN people p ON p.id = mp.person_id
        WHERE mp.memory_id = m.id
      ),
      '[]'::json
    ) AS people,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', md.id,
            'kind', md.kind,
            'originalFilename', md.original_filename,
            'mimeType', md.mime_type,
            'caption', md.caption
          )
          ORDER BY md.created_at
        )
        FROM media md
        WHERE md.memory_id = m.id
      ),
      '[]'::json
    ) AS media
  FROM memories m
  LEFT JOIN users u ON u.id = m.created_by
`;

function mapMemory(row: Record<string, unknown>): ArchiveMemory {
  return {
    id: String(row.id),
    title: String(row.title),
    story: row.story ? String(row.story) : null,
    dateLabel: row.date_label ? String(row.date_label) : null,
    place: row.place_name ? String(row.place_name) : null,
    status: row.status as ArchiveMemory["status"],
    contributor: row.contributor ? String(row.contributor) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    people: (row.people as string[]) ?? [],
    media: (row.media as MediaItem[]) ?? [],
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function listApprovedMemories(limit?: number) {
  const values: unknown[] = [];
  let sql = memorySelect + " WHERE m.status = 'approved' ORDER BY COALESCE(m.memory_date, m.created_at) DESC, m.created_at DESC";
  if (limit) {
    values.push(limit);
    sql += " LIMIT $1";
  }

  const result = await query(sql, values);
  return result.rows.map((row) => mapMemory(row));
}

export async function listPendingMemories() {
  const result = await query(
    memorySelect + " WHERE m.status = 'pending' ORDER BY m.created_at ASC"
  );
  return result.rows.map((row) => mapMemory(row));
}

export async function getVisibleMemory(id: string, user: CurrentUser) {
  const privileged = user.role === "admin" || user.role === "curator";
  const result = await query(
    memorySelect +
      ` WHERE m.id = $1
          AND (
            m.status = 'approved'
            OR m.created_by = $2
            OR $3::boolean = true
          )
        LIMIT 1`,
    [id, user.id, privileged]
  );

  return result.rows[0] ? mapMemory(result.rows[0]) : null;
}
