import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { permanentlyDeleteTrashedMedia } from "@/lib/media-trash";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function DELETE(
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
    const result = await permanentlyDeleteTrashedMedia(id);

    if (!result.ok && result.reason === "not_found") {
      return clientJson({ error: "Trash item not found." }, { status: 404 });
    }

    if (!result.ok && result.reason === "shared_file") {
      return clientJson(
        {
          error:
            "This file is still referenced elsewhere in the family archive, so permanent deletion was blocked."
        },
        { status: 409 }
      );
    }

    return clientJson({
      ok: true,
      fileCleanupWarning: result.fileCleanupWarning
    });
  } catch (error) {
    console.error("permanent media deletion failed", error);
    return clientJson(
      { error: "Could not permanently delete this Trash item." },
      { status: 500 }
    );
  }
}
