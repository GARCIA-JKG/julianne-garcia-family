import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listMappedMemories } from "@/lib/archive";

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

  const memories = await listMappedMemories();

  return clientJson({
    places: memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      dateLabel: memory.dateLabel,
      place: memory.place,
      latitude: memory.latitude,
      longitude: memory.longitude
    }))
  });
}
