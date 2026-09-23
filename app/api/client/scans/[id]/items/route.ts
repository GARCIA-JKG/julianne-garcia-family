import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { storeUpload } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const batch = await query("SELECT 1 FROM import_batches WHERE id = $1", [id]);
    if (!batch.rowCount) {
      return clientJson({ error: "Scan batch not found." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return clientJson({ error: "Choose a scanned photo." }, { status: 400 });
    }

    const stored = await storeUpload(file, "scan-" + id);
    if (stored.kind !== "photo") {
      return clientJson({ error: "Scan Inbox accepts photos only." }, { status: 400 });
    }

    const order = await query<{ next_order: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM import_items
       WHERE batch_id = $1`,
      [id]
    );

    const result = await query<{ id: string }>(
      `INSERT INTO import_items
        (batch_id, original_filename, storage_path, mime_type, bytes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        id,
        stored.originalFilename,
        stored.storagePath,
        stored.mimeType,
        stored.bytes,
        order.rows[0].next_order
      ]
    );

    return clientJson({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("client scan upload failed", error);
    return clientJson(
      { error: error instanceof Error ? error.message : "Could not upload scan." },
      { status: 500 }
    );
  }
}
