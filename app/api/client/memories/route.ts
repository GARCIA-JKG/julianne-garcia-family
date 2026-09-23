import { db } from "@/lib/db";
import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listApprovedMemories } from "@/lib/archive";
import { storeUpload } from "@/lib/media";
import { cleanText } from "@/lib/security";
import {
  formatMonthYear,
  geocodePlace,
  parseMonthYear,
  parsePlace
} from "@/lib/date-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

export async function GET(request: Request) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  const memories = await listApprovedMemories();

  return clientJson({
    memories: memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      story: memory.story,
      dateLabel: memory.dateLabel,
      place: memory.place,
      people: memory.people,
      contributor: memory.contributor,
      media: memory.media.map((item) => ({
        id: item.id,
        kind: item.kind,
        caption: item.caption,
        originalFilename: item.originalFilename
      }))
    }))
  });
}

export async function POST(request: Request) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  if (user.role === "viewer") {
    return clientJson(
      { error: "This family account has view-only access." },
      { status: 403 }
    );
  }

  try {
    const form = await request.formData();

    const title = cleanText(form.get("title"), 180);
    const story = cleanText(form.get("story"), 12_000);
    const { month, year } = parseMonthYear(form.get("monthYear"));
    const dateLabel = formatMonthYear(month, year);
    const place = parsePlace(
      form.get("locality"),
      form.get("region"),
      form.get("country")
    );
    const peopleRaw = cleanText(form.get("people"), 1000);

    const files = form
      .getAll("media")
      .filter(
        (item): item is File =>
          item instanceof File && item.size > 0
      );

    if (!title || (!story && files.length === 0)) {
      return clientJson(
        {
          error:
            "Give the memory a title and add a story or media."
        },
        { status: 400 }
      );
    }

    if (files.length > 25) {
      return clientJson(
        { error: "Limit each memory to 25 files." },
        { status: 400 }
      );
    }

    const geo = place.label ? await geocodePlace(place) : null;

    const client = await db.connect();
    let memoryId = "";

    try {
      await client.query("BEGIN");

      const memory = await client.query<{ id: string }>(
        `INSERT INTO memories (
          title,
          story,
          approximate_date_label,
          memory_year,
          memory_month,
          place_name,
          locality,
          region,
          country,
          latitude,
          longitude,
          status,
          created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, 'pending', $12
        )
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
          user.id
        ]
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

        await db.query(
          `INSERT INTO media (
            memory_id,
            kind,
            original_filename,
            storage_path,
            mime_type,
            bytes,
            uploaded_by
          )
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
      await db.query(
        "UPDATE memories SET status = 'rejected' WHERE id = $1",
        [memoryId]
      );
      throw error;
    }

    return clientJson({ ok: true, id: memoryId });
  } catch (error) {
    console.error("client memory submission failed", error);

    return clientJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save this memory."
      },
      { status: 500 }
    );
  }
}
