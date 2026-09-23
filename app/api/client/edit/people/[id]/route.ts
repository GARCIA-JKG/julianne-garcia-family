import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/security";
import { parseMonthYear } from "@/lib/date-location";
import { getPersonProfile, listOtherPeople } from "@/lib/people";

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
  if (!canCurate(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  const { id } = await params;
  const person = await getPersonProfile(id);
  if (!person) return clientJson({ error: "Person not found." }, { status: 404 });

  return clientJson({ person, otherPeople: await listOtherPeople(id) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!canCurate(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const displayName = cleanText(body.displayName, 160);
    const biography = cleanText(body.biography, 12000);
    const birthPlace = cleanText(body.birthPlace, 220);
    const birth = parseMonthYear(body.birthMonthYear);
    const death = parseMonthYear(body.deathMonthYear);

    if (!displayName) {
      return clientJson({ error: "Display name is required." }, { status: 400 });
    }

    const result = await query(
      "UPDATE people SET display_name = $1, biography = $2, birth_year = $3, birth_month = $4, death_year = $5, death_month = $6, birth_place = $7 WHERE id = $8 RETURNING id",
      [displayName, biography || null, birth.year, birth.month, death.year, death.month, birthPlace || null, id]
    );

    if (!result.rowCount) {
      return clientJson({ error: "Person not found." }, { status: 404 });
    }

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client person update failed", error);
    return clientJson({ error: "Could not update person." }, { status: 500 });
  }
}
