import { db, query } from "@/lib/db";
import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { getVisibleMemory } from "@/lib/archive";
import { listMemoryHistory, captureMemorySnapshot } from "@/lib/memory-history";
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

function canCurate(role: string) {
  return role === "admin" || role === "curator";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  const { id } = await params;
  const memory = await getVisibleMemory(id, user);
  if (!memory) {
    return clientJson({ error: "Memory not found." }, { status: 404 });
  }

  return clientJson({
    memory,
    history: await listMemoryHistory(memory.id)
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const form = await request.formData();

    const title = cleanText(form.get("title"), 180);
    const story = cleanText(form.get("story"), 12000);

    const existing = await query<{
      approximate_date_label: string | null;
      memory_year: number | null;
      memory_month: number | null;
      place_name: string | null;
      locality: string | null;
      region: string | null;
      country: string | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT
         approximate_date_label,
         memory_year,
         memory_month,
         place_name,
         locality,
         region,
         country,
         latitude,
         longitude
       FROM memories
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (!existing.rows[0]) {
      return clientJson({ error: "Memory not found." }, { status: 404 });
    }

    if (!title) {
      return clientJson(
        { error: "Memory title is required." },
        { status: 400 }
      );
    }

    const previous = existing.rows[0];
    const parsedDate = parseMonthYear(form.get("monthYear"));
    const hasStructuredDate =
      parsedDate.month !== null || parsedDate.year !== null;

    const month = hasStructuredDate
      ? parsedDate.month
      : previous.memory_month;
    const year = hasStructuredDate
      ? parsedDate.year
      : previous.memory_year;
    const dateLabel = hasStructuredDate
      ? formatMonthYear(month, year)
      : previous.approximate_date_label;

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
      )
      .slice(0, 25);

    await captureMemorySnapshot(id, user.id, changeSummary);

    const hasStructuredPlace = Boolean(place.label);
    const geo = hasStructuredPlace
      ? await geocodePlace(place)
      : null;

    const finalPlace = hasStructuredPlace
      ? place
      : {
          locality: previous.locality,
          region: previous.region,
          country: previous.country,
          label: previous.place_name
        };

    const finalLatitude = hasStructuredPlace
      ? geo?.latitude ?? null
      : previous.latitude;
    const finalLongitude = hasStructuredPlace
      ? geo?.longitude ?? null
      : previous.longitude;

    const storedFiles = [];
    for (const file of files) {
      storedFiles.push(await storeUpload(file, id));
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      await client.query(
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
         WHERE id = $12`,
        [
          title,
          story || null,
          dateLabel,
          year,
          month,
          finalPlace.label,
          finalPlace.locality,
          finalPlace.region,
          finalPlace.country,
          finalLatitude,
          finalLongitude,
          id
        ]
      );

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

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client Memory enrichment failed", error);
    return clientJson(
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
