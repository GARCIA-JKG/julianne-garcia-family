import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  const { id: batchId } = await params;
  const body = await request.json().catch(() => ({}));
  const itemIds = Array.isArray(body.itemIds)
    ? Array.from(
        new Set(
          body.itemIds.filter(
            (value: unknown): value is string => typeof value === "string"
          )
        )
      ).slice(0, 200)
    : [];

  const action =
    body.action === "left"
      ? "left"
      : body.action === "right"
        ? "right"
        : body.action === "reset"
          ? "reset"
          : null;

  if (!itemIds.length || !action) {
    return clientJson(
      { error: "Select scans and choose a valid rotation." },
      { status: 400 }
    );
  }

  try {
    const result = await query(
      `UPDATE import_items
       SET rotation_degrees = CASE
         WHEN $1 = 'left' THEN (rotation_degrees + 270) % 360
         WHEN $1 = 'right' THEN (rotation_degrees + 90) % 360
         ELSE 0
       END
       WHERE batch_id = $2
         AND id = ANY($3::uuid[])
         AND status = 'pending'
       RETURNING id`,
      [action, batchId, itemIds]
    );

    if (result.rowCount !== itemIds.length) {
      return clientJson(
        { error: "One or more selected scans are no longer available." },
        { status: 409 }
      );
    }

    return clientJson({ ok: true, updated: result.rowCount });
  } catch (error) {
    console.error("scan rotation failed", error);
    return clientJson({ error: "Could not rotate selected scans." }, { status: 500 });
  }
}
