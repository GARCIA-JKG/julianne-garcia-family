import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { getVisibleMemory } from "@/lib/archive";
import { listApprovedRecollections } from "@/lib/recollections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const memory = await getVisibleMemory(id, user);

  if (!memory || memory.status !== "approved") {
    return clientJson({ error: "Memory not found." }, { status: 404 });
  }

  const recollections = await listApprovedRecollections(memory.id);

  return clientJson({
    memory: {
      id: memory.id,
      title: memory.title,
      story: memory.story,
      dateLabel: memory.dateLabel,
      place: memory.place,
      locality: memory.locality,
      region: memory.region,
      country: memory.country,
      people: memory.people,
      contributor: memory.contributor,
      media: memory.media.map((item) => ({
        id: item.id,
        kind: item.kind,
        caption: item.caption,
        originalFilename: item.originalFilename
      })),
      recollections
    }
  });
}
