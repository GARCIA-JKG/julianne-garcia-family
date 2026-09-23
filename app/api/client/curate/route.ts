import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listPendingMemories } from "@/lib/archive";
import { listPendingRecollections } from "@/lib/recollections";

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

  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  const [memories, recollections] = await Promise.all([
    listPendingMemories(),
    listPendingRecollections()
  ]);

  return clientJson({
    memories: memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      story: memory.story,
      dateLabel: memory.dateLabel,
      place: memory.place,
      contributor: memory.contributor,
      people: memory.people,
      createdAt: memory.createdAt,
      media: memory.media.map((item) => ({
        id: item.id,
        kind: item.kind,
        caption: item.caption,
        originalFilename: item.originalFilename
      }))
    })),
    recollections
  });
}
