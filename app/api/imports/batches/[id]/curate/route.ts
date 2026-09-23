import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin, cleanText } from "@/lib/security";
import {
  formatMonthYear,
  geocodePlace,
  parseMonthYear,
  parsePlace
} from "@/lib/date-location";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["admin", "curator"]);

  try {
    assertSameOrigin(request);
    const { id: batchId } = await params;
    const body = await request.json();

    const itemIds = Array.isArray(body.itemIds)
      ? Array.from(
          new Set(
            body.itemIds.filter(
              (value: unknown): value is string =>
                typeof value === "string"
            )
          )
        ).slice(0, 100)
      : [];

    const title = cleanText(body.title, 180);
    const story = cleanText(body.story, 12000);
    const { month, year } = parseMonthYear(
      body.month,
      body.year
    );
    const dateLabel = formatMonthYear(month, year);
    const place = parsePlace(
      body.locality,
      body.region,
      body.country
    );
    const peopleRaw = cleanText(body.people, 1000);

    if (!title || itemIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Select at least one scan and give the Memory a title."
        },
        { status: 400 }
      );
    }

    const geo = place.label
      ? await geocodePlace(place)
      : null;

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const selected = await client.query<{
        id: string;
        original_filename: string;
        storage_path: string;
        mime_type: string;
        bytes: string;
        sort_order: number;
      }>(
        `SELECT
           id,
           original_filename,
           storage_path,
           mime_type,
           bytes::text,
           sort_order
         FROM import_items
         WHERE batch_id = $1
           AND id = ANY($2::uuid[])
           AND status = 'pending'
         ORDER BY sort_order
         FOR UPDATE`,
        [batchId, itemIds]
      );

      if (selected.rowCount !== itemIds.length) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "One or more selected scans are no longer available for curation."
          },
          { status: 409 }
        );
      }

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

      const memoryId = memory.rows[0].id;

      for (
        let index = 0;
        index < selected.rows.length;
        index += 1
      ) {
        const item = selected.rows[index];

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
          VALUES (
            $1, 'photo', $2, $3, $4, $5, $6, $7
          )`,
          [
            memoryId,
            item.original_filename,
            item.storage_path,
            item.mime_type,
            Number(item.bytes),
            user.id,
            index
          ]
        );
      }

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

      await client.query(
        `UPDATE import_items
         SET status = 'curated',
             curated_memory_id = $1
         WHERE batch_id = $2
           AND id = ANY($3::uuid[])`,
        [memoryId, batchId, itemIds]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        memoryId
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("scan curation failed", error);

    return NextResponse.json(
      { error: "Could not curate these scans." },
      { status: 500 }
    );
  }
}
