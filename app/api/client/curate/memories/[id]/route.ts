import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";

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

  if (user.role !== "admin" && user.role !== "curator") {
    return clientJson({ error: "Curator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status =
    body.status === "approved"
      ? "approved"
      : body.status === "rejected"
        ? "rejected"
        : null;

  if (!status) {
    return clientJson({ error: "Invalid review decision." }, { status: 400 });
  }

  try {
    const { id } = await params;
    const result = await query(
      `UPDATE memories
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3
         AND status = 'pending'
       RETURNING id`,
      [status, user.id, id]
    );

    if (!result.rowCount) {
      return clientJson(
        { error: "This Memory is no longer waiting for review." },
        { status: 409 }
      );
    }

    return clientJson({ ok: true, status });
  } catch (error) {
    console.error("client Memory review failed", error);
    return clientJson({ error: "Could not review Memory." }, { status: 500 });
  }
}
