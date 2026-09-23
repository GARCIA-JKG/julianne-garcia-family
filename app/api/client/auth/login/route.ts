import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { cleanText, normalizeEmail } from "@/lib/security";
import { createBearerSession } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(cleanText(body.email, 254));
    const password =
      typeof body.password === "string" ? body.password : "";

    const result = await query<{
      id: string;
      email: string;
      display_name: string;
      role: "admin" | "curator" | "family" | "viewer";
      password_hash: string;
      active: boolean;
    }>(
      `SELECT id, email, display_name, role, password_hash, active
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.active ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return clientJson(
        { error: "Email or password is incorrect." },
        { status: 401 }
      );
    }

    const token = await createBearerSession(user.id);

    return clientJson({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error("client login failed", error);
    return clientJson(
      { error: "Could not sign in." },
      { status: 500 }
    );
  }
}
