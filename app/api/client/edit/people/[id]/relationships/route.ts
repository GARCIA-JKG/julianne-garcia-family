import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/security";

export const runtime = "nodejs";

const reciprocalLabels: Record<string, string> = {
  parent: "child",
  child: "parent",
  spouse: "spouse",
  sibling: "sibling",
  grandparent: "grandchild",
  grandchild: "grandparent",
  "aunt/uncle": "niece/nephew",
  "niece/nephew": "aunt/uncle",
  cousin: "cousin",
  "other family": "other family"
};

const allowedLabels = new Set(Object.keys(reciprocalLabels));

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const relatedPersonId = cleanText(body.relatedPersonId, 40);
    const label = cleanText(body.label, 40).toLowerCase();

    if (!relatedPersonId || !allowedLabels.has(label) || relatedPersonId === id) {
      return clientJson({ error: "Choose a valid family relationship." }, { status: 400 });
    }

    await query(
      "INSERT INTO person_relationships (person_id, related_person_id, relationship_label) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [id, relatedPersonId, label]
    );
    await query(
      "INSERT INTO person_relationships (person_id, related_person_id, relationship_label) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [relatedPersonId, id, reciprocalLabels[label]]
    );

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client relationship create failed", error);
    return clientJson({ error: "Could not add relationship." }, { status: 500 });
  }
}
