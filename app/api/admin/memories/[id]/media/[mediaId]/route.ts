import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { cleanText, assertSameOrigin } from "@/lib/security";
import { captureMemorySnapshot } from "@/lib/memory-history";

export const runtime = "nodejs";

async function authorize() {
  const user = await getCurrentUser();
  return user && ["admin", "curator"].includes(user.role)
    ? user
    : null;
}

export async function PUT(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string; mediaId: string }>;
  }
) {
  const user = await authorize();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    assertSameOrigin(request);
    const { id, mediaId } = await params;
    const body = await request.json();
    const caption = cleanText(body.caption, 1000);
    const sortOrder = Math.max(
      0,
      Math.min(999, Number(body.sortOrder) || 0)
    );
    const makeCover = body.makeCover === true;

    await captureMemorySnapshot(
      id,
      user.id,
      makeCover
        ? "Updated media details and cover photo"
        : "Updated media details"
    );

    const updated = await query(
      `UPDATE media
       SET caption = $1, sort_order = $2
       WHERE id = $3
         AND memory_id = $4
         AND archived = false
       RETURNING id`,
      [caption || null, sortOrder, mediaId, id]
    );

    if (!updated.rowCount) {
      return NextResponse.json(
        { error: "Media not found." },
        { status: 404 }
      );
    }

    if (makeCover) {
      await query(
        `UPDATE memories
         SET cover_media_id = $1, updated_at = now()
         WHERE id = $2`,
        [mediaId, id]
      );
    } else {
      await query(
        `UPDATE memories
         SET cover_media_id = NULL, updated_at = now()
         WHERE id = $1
           AND cover_media_id = $2`,
        [id, mediaId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("media update failed", error);
    return NextResponse.json(
      { error: "Could not update media." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string; mediaId: string }>;
  }
) {
  const user = await authorize();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    assertSameOrigin(request);
    const { id, mediaId } = await params;

    await captureMemorySnapshot(
      id,
      user.id,
      "Archived media from visible Memory"
    );

    const archived = await query(
      `UPDATE media
       SET archived = true
       WHERE id = $1
         AND memory_id = $2
         AND archived = false
       RETURNING id`,
      [mediaId, id]
    );

    if (!archived.rowCount) {
      return NextResponse.json(
        { error: "Media not found." },
        { status: 404 }
      );
    }

    await query(
      `UPDATE memories
       SET
         cover_media_id = CASE
           WHEN cover_media_id = $1 THEN NULL
           ELSE cover_media_id
         END,
         updated_at = now()
       WHERE id = $2`,
      [mediaId, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("media archive failed", error);
    return NextResponse.json(
      { error: "Could not archive media." },
      { status: 500 }
    );
  }
}
