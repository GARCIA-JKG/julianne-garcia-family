import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { createAssetTicket } from "@/lib/asset-ticket";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(request: Request) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mediaIds = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  const recollectionIds = Array.isArray(body.recollectionIds)
    ? body.recollectionIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  const scanIds = Array.isArray(body.scanIds)
    ? body.scanIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 200)
    : [];

  const mediaResult = mediaIds.length
    ? await query<{ id: string }>(
        `SELECT DISTINCT md.id
         FROM media md
         JOIN memories m ON m.id = md.memory_id
         WHERE md.id = ANY($1::uuid[])
           AND md.archived = false
           AND m.status = 'approved'`,
        [mediaIds]
      )
    : { rows: [] as Array<{ id: string }> };

  const recollectionResult = recollectionIds.length
    ? await query<{ id: string }>(
        `SELECT r.id
         FROM recollections r
         JOIN memories m ON m.id = r.memory_id
         WHERE r.id = ANY($1::uuid[])
           AND r.status = 'approved'
           AND m.status = 'approved'
           AND r.voice_storage_path IS NOT NULL`,
        [recollectionIds]
      )
    : { rows: [] as Array<{ id: string }> };

  const canCurate = user.role === "admin" || user.role === "curator";
  const scanResult = canCurate && scanIds.length
    ? await query<{ id: string }>(
        `SELECT id
         FROM import_items
         WHERE id = ANY($1::uuid[])`,
        [scanIds]
      )
    : { rows: [] as Array<{ id: string }> };

  return clientJson({
    mediaTickets: Object.fromEntries(
      mediaResult.rows.map((row) => [
        row.id,
        createAssetTicket("media", row.id, user.id)
      ])
    ),
    recollectionTickets: Object.fromEntries(
      recollectionResult.rows.map((row) => [
        row.id,
        createAssetTicket("recollection", row.id, user.id)
      ])
    ),
    scanTickets: Object.fromEntries(
      scanResult.rows.map((row) => [
        row.id,
        createAssetTicket("scan", row.id, user.id)
      ])
    )
  });
}
