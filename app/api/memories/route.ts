import { NextResponse } from "next/server";
import { db, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storeUpload } from "@/lib/media";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    const form = await request.formData();

    const title = cleanText(form.get("title"), 180);
    const story = cleanText(form.get("story"), 12_000);
    const dateLabel = cleanText(form.get("date"), 80);
    const place = cleanText(form.get("place"), 180);
    const peopleRaw = cleanText(form.get("people"), 1000);
    const files = form
      .getAll("media")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!title || (!story && files.length === 0)) {
      return NextResponse.json(
        { error: "Give the memory a title and add a story or media." },
        { status: 400 }
      );
    }

    if (files.length > 25) {
      return NextResponse.json({ error: "Limit each memory to 25 files." }, { status: 400 });
    }

    const client = await db.connect();
    let memoryId = "";

    try {
      await client.query("BEGIN");
      const memory = await client.query<{ id: string }>(
        `INSERT INTO memories
          (title, story, approximate_date_label, place_name, status, created_by)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING id`,
        [title, story || null, dateLabel || null, place || null, user.id]
      );
      memoryId = memory.rows[0].id;

      const people = Array.from(
        new Set(
          peopleRaw
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
            .slice(0, 30)
        )
      );

      for (const displayName of people) {
        const person = await client.query<{ id: string }>(
          `INSERT INTO people (display_name)
           VALUES ($1)
           ON CONFLICT ((lower(display_name)))
           DO UPDATE SET display_name = EXCLUDED.display_name
           RETURNING id`,
          [displayName]
        );
        await client.query(
          `INSERT INTO memory_people (memory_id, person_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [memoryId, person.rows[0].id]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    try {
      for (const file of files) {
        const stored = await storeUpload(file, memoryId);
        await query(
          `INSERT INTO media
            (memory_id, kind, original_filename, storage_path, mime_type, bytes, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            memoryId,
            stored.kind,
            stored.originalFilename,
            stored.storagePath,
            stored.mimeType,
            stored.bytes,
            user.id
          ]
        );
      }
    } catch (error) {
      await query("UPDATE memories SET status = 'rejected' WHERE id = $1", [memoryId]);
      throw error;
    }

    return NextResponse.json({ ok: true, id: memoryId });
  } catch (error) {
    console.error("memory submission failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save this memory." },
      { status: 500 }
    );
  }
}
