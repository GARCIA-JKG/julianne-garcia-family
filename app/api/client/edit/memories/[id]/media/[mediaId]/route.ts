import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/security";
import { captureMemorySnapshot } from "@/lib/memory-history";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

function canCurate(role: string) {
  return role === "admin" || role === "curator";
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  try {
    const { id, mediaId } = await params;
    const body = await request.json();
    const caption = cleanText(body.caption, 1000);
    const sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    const makeCover = body.makeCover === true;

    await captureMemorySnapshot(
      id,
      user.id,
      makeCover ? "Updated media details and cover photo" : "Updated media details"
    );

    const updated = await query(
      "UPDATE media SET caption = $1, sort_order = $2 WHERE id = $3 AND memory_id = $4 AND archived = false RETURNING id",
      [caption || null, sortOrder, mediaId, id]
    );

    if (!updated.rowCount) {
      return clientJson({ error: "Media not found." }, { status: 404 });
    }

    if (makeCover) {
      await query(
        "UPDATE memories SET cover_media_id = $1, updated_at = now() WHERE id = $2",
        [mediaId, id]
      );
    } else {
      await query(
        "UPDATE memories SET cover_media_id = NULL, updated_at = now() WHERE id = $1 AND cover_media_id = $2",
        [id, mediaId]
      );
    }

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client media update failed", error);
    return clientJson({ error: "Could not update media." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  try {
    const { id, mediaId } = await params;
    const body = await request.json().catch(() => ({}));
    const action =
      body.action === "left"
        ? "left"
        : body.action === "right"
          ? "right"
          : body.action === "reset"
            ? "reset"
            : null;

    if (!action) {
      return clientJson({ error: "Invalid rotation action." }, { status: 400 });
    }

    await captureMemorySnapshot(id, user.id, "Rotated photo");

    const result = await query<{ rotation_degrees: number }>(
      `UPDATE media
       SET rotation_degrees = CASE
         WHEN $1 = 'left' THEN (rotation_degrees + 270) % 360
         WHEN $1 = 'right' THEN (rotation_degrees + 90) % 360
         ELSE 0
       END
       WHERE id = $2
         AND memory_id = $3
         AND kind = 'photo'
         AND archived = false
         AND trashed_at IS NULL
       RETURNING rotation_degrees`,
      [action, mediaId, id]
    );

    if (!result.rows[0]) {
      return clientJson({ error: "Photo not found." }, { status: 404 });
    }

    return clientJson({
      ok: true,
      rotationDegrees: result.rows[0].rotation_degrees
    });
  } catch (error) {
    console.error("client media rotation failed", error);
    return clientJson({ error: "Could not rotate photo." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  try {
    const { id, mediaId } = await params;

    await captureMemorySnapshot(id, user.id, "Archived media from visible Memory");

    const archived = await query(
      "UPDATE media SET archived = true WHERE id = $1 AND memory_id = $2 AND archived = false RETURNING id",
      [mediaId, id]
    );

    if (!archived.rowCount) {
      return clientJson({ error: "Media not found." }, { status: 404 });
    }

    await query(
      "UPDATE memories SET cover_media_id = CASE WHEN cover_media_id = $1 THEN NULL ELSE cover_media_id END, updated_at = now() WHERE id = $2",
      [mediaId, id]
    );

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client media archive failed", error);
    return clientJson({ error: "Could not archive media." }, { status: 500 });
  }
}
