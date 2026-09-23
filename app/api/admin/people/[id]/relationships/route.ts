import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin, cleanText } from "@/lib/security";

export const runtime = "nodejs";

const allowedLabels = new Set([
  "parent",
  "child",
  "spouse",
  "sibling",
  "grandparent",
  "grandchild",
  "aunt/uncle",
  "niece/nephew",
  "cousin",
  "other family"
]);

export async function POST(
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
    const relatedPersonId = cleanText(body.relatedPersonId, 40);
    const label = cleanText(body.label, 40).toLowerCase();

    if (
      !relatedPersonId ||
      !allowedLabels.has(label) ||
      relatedPersonId === id
    ) {
      return NextResponse.json(
        { error: "Choose a valid family relationship." },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO person_relationships (
         person_id,
         related_person_id,
         relationship_label
       )
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [id, relatedPersonId, label]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("relationship create failed", error);
    return NextResponse.json(
      { error: "Could not add relationship." },
      { status: 500 }
    );
  }
}
