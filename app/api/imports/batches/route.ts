import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireRole(["admin", "curator"]);

  try {
    assertSameOrigin(request);
    const body = await request.json();
    const name = cleanText(body.name, 160);
    const source = cleanText(body.source, 200);
    const notes = cleanText(body.notes, 500);

    if (!name) {
      return NextResponse.json({ error: "Batch name is required." }, { status: 400 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO import_batches (name, source, notes, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, source || null, notes || null, user.id]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("create scan batch failed", error);
    return NextResponse.json({ error: "Could not create scan batch." }, { status: 500 });
  }
}
