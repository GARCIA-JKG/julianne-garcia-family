import { unlink } from "node:fs/promises";
import path from "node:path";
import { db, query } from "@/lib/db";
import { captureMemorySnapshot } from "@/lib/memory-history";

export type TrashItem = {
  id: string;
  memoryId: string;
  memoryTitle: string;
  kind: "photo" | "video" | "audio";
  originalFilename: string;
  mimeType: string | null;
  bytes: number | null;
  caption: string | null;
  trashedAt: string;
  trashedBy: string | null;
};

export async function listTrashedMedia(): Promise<TrashItem[]> {
  const result = await query<{
    id: string;
    memory_id: string;
    memory_title: string;
    kind: "photo" | "video" | "audio";
    original_filename: string;
    mime_type: string | null;
    bytes: string | null;
    caption: string | null;
    trashed_at: string;
    trashed_by_name: string | null;
  }>(
    `SELECT
       md.id,
       md.memory_id,
       m.title AS memory_title,
       md.kind,
       md.original_filename,
       md.mime_type,
       md.bytes::text,
       md.caption,
       md.trashed_at,
       u.display_name AS trashed_by_name
     FROM media md
     JOIN memories m ON m.id = md.memory_id
     LEFT JOIN users u ON u.id = md.trashed_by
     WHERE md.trashed_at IS NOT NULL
     ORDER BY md.trashed_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    memoryId: row.memory_id,
    memoryTitle: row.memory_title,
    kind: row.kind,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    bytes: row.bytes === null ? null : Number(row.bytes),
    caption: row.caption,
    trashedAt: new Date(row.trashed_at).toISOString(),
    trashedBy: row.trashed_by_name
  }));
}

export async function moveMediaToTrash(
  memoryId: string,
  mediaId: string,
  userId: string
) {
  await captureMemorySnapshot(
    memoryId,
    userId,
    "Moved media to Trash"
  );

  const result = await query(
    `UPDATE media
     SET
       archived = true,
       trashed_at = now(),
       trashed_by = $3
     WHERE id = $1
       AND memory_id = $2
       AND archived = false
       AND trashed_at IS NULL
     RETURNING id`,
    [mediaId, memoryId, userId]
  );

  if (!result.rowCount) return false;

  await query(
    `UPDATE memories
     SET
       cover_media_id = CASE
         WHEN cover_media_id = $1 THEN NULL
         ELSE cover_media_id
       END,
       updated_at = now()
     WHERE id = $2`,
    [mediaId, memoryId]
  );

  await query(
    `UPDATE albums
     SET cover_media_id = NULL
     WHERE cover_media_id = $1`,
    [mediaId]
  );

  return true;
}

export async function restoreTrashedMedia(
  mediaId: string,
  userId: string
) {
  const current = await query<{ memory_id: string }>(
    `SELECT memory_id
     FROM media
     WHERE id = $1
       AND trashed_at IS NOT NULL
     LIMIT 1`,
    [mediaId]
  );

  if (!current.rows[0]) return false;

  await captureMemorySnapshot(
    current.rows[0].memory_id,
    userId,
    "Restored media from Trash"
  );

  const result = await query(
    `UPDATE media
     SET
       archived = false,
       trashed_at = NULL,
       trashed_by = NULL
     WHERE id = $1
       AND trashed_at IS NOT NULL
     RETURNING id`,
    [mediaId]
  );

  return Boolean(result.rowCount);
}

async function safeUnlink(
  filePath: string | null,
  allowedRoot: string
) {
  if (!filePath) return true;

  const root = path.resolve(allowedRoot);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Media path is outside the managed archive.");
  }

  try {
    await unlink(resolved);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return true;
    }
    throw error;
  }
}

export async function permanentlyDeleteTrashedMedia(mediaId: string) {
  const client = await db.connect();

  let storagePath: string | null = null;
  let derivativePath: string | null = null;

  try {
    await client.query("BEGIN");

    const item = await client.query<{
      storage_path: string;
      derivative_path: string | null;
    }>(
      `SELECT storage_path, derivative_path
       FROM media
       WHERE id = $1
         AND trashed_at IS NOT NULL
       FOR UPDATE`,
      [mediaId]
    );

    if (!item.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "not_found" as const };
    }

    storagePath = item.rows[0].storage_path;
    derivativePath = item.rows[0].derivative_path;

    const sharedOriginal = await client.query(
      `SELECT 1
       FROM (
         SELECT storage_path AS path
         FROM media
         WHERE id <> $1
         UNION ALL
         SELECT derivative_path AS path
         FROM media
         WHERE id <> $1
           AND derivative_path IS NOT NULL
         UNION ALL
         SELECT storage_path AS path
         FROM import_items
         UNION ALL
         SELECT voice_storage_path AS path
         FROM recollections
         WHERE voice_storage_path IS NOT NULL
       ) refs
       WHERE refs.path = $2
       LIMIT 1`,
      [mediaId, storagePath]
    );

    if (sharedOriginal.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "shared_file" as const };
    }

    if (derivativePath) {
      const sharedDerivative = await client.query(
        `SELECT 1
         FROM media
         WHERE id <> $1
           AND (
             storage_path = $2
             OR derivative_path = $2
           )
         LIMIT 1`,
        [mediaId, derivativePath]
      );

      if (sharedDerivative.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false as const, reason: "shared_file" as const };
      }
    }

    await client.query(
      "UPDATE albums SET cover_media_id = NULL WHERE cover_media_id = $1",
      [mediaId]
    );

    await client.query(
      "DELETE FROM media WHERE id = $1",
      [mediaId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await safeUnlink(
    storagePath,
    process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads"
  );

  if (derivativePath) {
    await safeUnlink(
      derivativePath,
      process.env.MEDIA_PROCESSED_ROOT ?? "/media/processed"
    );
  }

  return { ok: true as const };
}
