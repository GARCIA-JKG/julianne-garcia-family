import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { assertSameOrigin, cleanText, normalizeEmail } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const email = normalizeEmail(cleanText(body.email, 254));
    const password = typeof body.password === "string" ? body.password : "";

    const result = await query<{
      id: string;
      password_hash: string;
      active: boolean;
    }>(
      `SELECT id, password_hash, active
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
