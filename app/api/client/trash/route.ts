import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listTrashedMedia } from "@/lib/media-trash";

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

  if (user.role !== "admin") {
    return clientJson({ error: "Admin access required." }, { status: 403 });
  }

  return clientJson({ items: await listTrashedMedia() });
}
