import { createHash } from "node:crypto";
import { getBearerUser, bearerToken } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validPassword } from "@/lib/security";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(request: Request) {
  const user = await getBearerUser(request);
  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!validPassword(newPassword)) {
      return clientJson(
        { error: "New password must be between 12 and 200 characters." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return clientJson(
        { error: "Choose a new password that is different from the current one." },
        { status: 400 }
      );
    }

    const result = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1 AND active = true",
      [user.id]
    );

    if (
      !result.rows[0] ||
      !(await verifyPassword(currentPassword, result.rows[0].password_hash))
    ) {
      return clientJson(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    await query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [await hashPassword(newPassword), user.id]
    );

    const token = bearerToken(request);
    const currentHash = token
      ? createHash("sha256").update(token).digest("hex")
      : "";

    await query(
      "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2",
      [user.id, currentHash]
    );

    return clientJson({ ok: true });
  } catch (error) {
    console.error("client password change failed", error);
    return clientJson(
      { error: "Could not change password." },
      { status: 500 }
    );
  }
}
