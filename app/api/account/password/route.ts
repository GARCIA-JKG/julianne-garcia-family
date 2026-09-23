import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { assertSameOrigin, validPassword } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!validPassword(newPassword)) {
      return NextResponse.json(
        { error: "New password must be at least 12 characters." },
        { status: 400 }
      );
    }

    const result = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1 AND active = true",
      [user.id]
    );

    if (!result.rows[0] || !(await verifyPassword(currentPassword, result.rows[0].password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    await query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [await hashPassword(newPassword), user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("password change failed", error);
    return NextResponse.json({ error: "Could not change password." }, { status: 500 });
  }
}
