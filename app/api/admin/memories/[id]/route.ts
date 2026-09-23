import { NextResponse } from "next/server";
import { db, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storeUpload } from "@/lib/media";
import { cleanText, assertSameOrigin } from "@/lib/security";
import {
  formatMonthYear,
  geocodePlace,
  parseMonthYear,
  parsePlace
} from "@/lib/date-location";
import { captureMemorySnapshot } from "@/lib/memory-history";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user || !["admin", "curator"].includes(user.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    assertSameOrigin(request);
    const { id } = await params;
    const form = await request.formData();

    const title = cleanText(form.get("title"), 180);
    const story = cleanText(form.get("story"), 12000);
    const { month, year } = parseMonthYear(form.get("monthYear"));
    const dateLabel = formatMonthYear(month, year);
    const place = parsePlace(
      form.get("locality"),
      form.get("region"),
      form.get("country")
    );
    const peopleRaw = cleanText(form.get("people"), 1000);
    const changeSummary =
      cleanText(form.get("changeSummary"), 240) ||
      "Updated Memory details";
    const files = form
      .getAll("media")
      .filter(
        (item): item is File =>
          item instanceof File && item.size > 0
      );

    if (!title) {
      return NextResponse.json(
        { error: "Memory title is required." },
        { status: 400 }
      );
    }

    await captureMemorySnapshot(id, user.id, changeSummary);

    const geo = place.label ? await geocodePlace(place) : null;
    const storedFiles = [];

    for (const file of files.slice(0, 25)) {
      storedFiles.push(await storeUpload(file, id));
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const updated = await client.query(
        `UPDATE memories
         SET
           title = $1,
           story = $2,
           approximate_date_label = $3,
           memory_year = $4,
           memory_month = $5,
           place_name = $6,
           locality = $7,
           region = $8,
           country = $9,
           latitude = $10,
           longitude = $11,
           updated_at = now()
         WHERE id = $12
         RETURNING id`,
        [
          title,
          story || null,
          dateLabel,
          year,
          month,
          place.label,
          place.locality,
          place.region,
          place.country,
          geo?.latitude ?? null,
          geo?.longitude ?? null,
          id
        ]
      );

      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Memory not found." },
          { status: 404 }
        );
      }

      await client.query(
        "DELETE FROM memory_people WHERE memory_id = $1",
        [id]
      );

      const people = Array.from(
        new Set(
          peopleRaw
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
            .slice(0, 50)
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
          [id, person.rows[0].id]
        );
      }

      const order = await client.query<{ next_order: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
         FROM media
         WHERE memory_id = $1
           AND archived = false`,
        [id]
      );

      let nextOrder = Number(order.rows[0].next_order);

      for (const stored of storedFiles) {
        await client.query(
          `INSERT INTO media (
             memory_id,
             kind,
             original_filename,
             storage_path,
             mime_type,
             bytes,
             uploaded_by,
             sort_order
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            stored.kind,
            stored.originalFilename,
            stored.storagePath,
            stored.mimeType,
            stored.bytes,
            user.id,
            nextOrder++
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("memory enrichment failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update Memory."
      },
      { status: 500 }
    );
  }
}
