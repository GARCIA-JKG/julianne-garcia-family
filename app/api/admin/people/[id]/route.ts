import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin, cleanText } from "@/lib/security";
import { parseMonthYear } from "@/lib/date-location";

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
    const body = await request.json();

    const displayName = cleanText(body.displayName, 160);
    const biography = cleanText(body.biography, 12000);
    const birthPlace = cleanText(body.birthPlace, 220);
    const birth = parseMonthYear(body.birthMonthYear);
    const death = parseMonthYear(body.deathMonthYear);

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required." },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE people
       SET
         display_name = $1,
         biography = $2,
         birth_year = $3,
         birth_month = $4,
         death_year = $5,
         death_month = $6,
         birth_place = $7
       WHERE id = $8
       RETURNING id`,
      [
        displayName,
        biography || null,
        birth.year,
        birth.month,
        death.year,
        death.month,
        birthPlace || null,
        id
      ]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Person not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("person update failed", error);
    return NextResponse.json(
      { error: "Could not update person." },
      { status: 500 }
    );
  }
}
