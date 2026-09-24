import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { moveMediaToTrash } from "@/lib/media-trash";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return clientJson({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { id, mediaId } = await params;
    const moved = await moveMediaToTrash(id, mediaId, user.id);

    if (!moved) {
      return clientJson(
        { error: "Media is no longer available to move to Trash." },
        { status: 409 }
      );
    }

    return clientJson({ ok: true });
  } catch (error) {
    console.error("move media to Trash failed", error);
    return clientJson({ error: "Could not move media to Trash." }, { status: 500 });
  }
}
