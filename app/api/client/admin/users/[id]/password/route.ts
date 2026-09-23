import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { validPassword } from "@/lib/security";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getBearerUser(request);
  if (!current) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (current.role !== "admin") return clientJson({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  if (id === current.id) {
    return clientJson({ error: "Use Account to change your own password." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!validPassword(newPassword)) {
      return clientJson({ error: "Temporary password must be between 12 and 200 characters." }, { status: 400 });
    }

    const target = await query<{ active: boolean }>(
      "SELECT active FROM users WHERE id = $1 LIMIT 1",
      [id]
    );

    if (!target.rows[0]) {
      return clientJson({ error: "Family account not found." }, { status: 404 });
    }

    if (!target.rows[0].active) {
      return clientJson({ error: "Reactivate this account before resetting its password." }, { status: 400 });
    }

    await query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [await hashPassword(newPassword), id]
    );
    await query("DELETE FROM sessions WHERE user_id = $1", [id]);

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client admin password reset failed", error);
    return clientJson({ error: "Could not reset this password." }, { status: 500 });
  }
}
