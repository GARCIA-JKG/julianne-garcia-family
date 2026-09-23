import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { storeUpload } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["admin", "curator"]);

  try {
    assertSameOrigin(request);
    const { id } = await params;

    const batch = await query("SELECT 1 FROM import_batches WHERE id = $1", [id]);
    if (!batch.rowCount) {
      return NextResponse.json({ error: "Scan batch not found." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Choose a scanned photo." }, { status: 400 });
    }

    const stored = await storeUpload(file, "scan-" + id);
    if (stored.kind !== "photo") {
      return NextResponse.json({ error: "Scan Inbox accepts photos only." }, { status: 400 });
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

    return NextResponse.json({ ok: true, id: result.rows[0].id, uploadedBy: user.id });
  } catch (error) {
    console.error("scan upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload scan." },
      { status: 500 }
    );
  }
}
