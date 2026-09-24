import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { restoreTrashedMedia } from "@/lib/media-trash";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return clientJson({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const restored = await restoreTrashedMedia(id, user.id);

    if (!restored) {
      return clientJson({ error: "Trash item not found." }, { status: 404 });
    }

    return clientJson({ ok: true });
  } catch (error) {
    console.error("restore media failed", error);
    return clientJson({ error: "Could not restore media." }, { status: 500 });
  }
}
