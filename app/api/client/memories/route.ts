import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listApprovedMemories } from "@/lib/archive";

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
