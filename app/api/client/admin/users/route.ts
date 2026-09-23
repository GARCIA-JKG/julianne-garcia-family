import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { cleanText, normalizeEmail, validPassword } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles = new Set(["curator", "family", "viewer"]);

export function OPTIONS() {
  return clientOptions();
}

export async function GET(request: Request) {
  const current = await getBearerUser(request);
  if (!current) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (current.role !== "admin") return clientJson({ error: "Admin access required." }, { status: 403 });

  const result = await query<{
    id: string;
    display_name: string;
    email: string;
    role: string;
    active: boolean;
  }>(
    "SELECT id, display_name, email, role, active FROM users ORDER BY display_name, email"
  );

  return clientJson({
    users: result.rows.map((user) => ({
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      role: user.role,
      active: user.active
    }))
  });
}

export async function POST(request: Request) {
  const current = await getBearerUser(request);
  if (!current) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (current.role !== "admin") return clientJson({ error: "Admin access required." }, { status: 403 });

  try {
    const body = await request.json();
    const displayName = cleanText(body.displayName, 120);
    const email = normalizeEmail(cleanText(body.email, 254));
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" && roles.has(body.role) ? body.role : "family";

    if (!displayName || !email.includes("@") || !validPassword(password)) {
      return clientJson(
        { error: "Enter a name, valid email, and temporary password of at least 12 characters." },
        { status: 400 }
      );
    }

    await query(
      "INSERT INTO users (email, display_name, password_hash, role) VALUES ($1, $2, $3, $4)",
      [email, displayName, await hashPassword(password), role]
    );

    return clientJson({ ok: true });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "23505") {
      return clientJson({ error: "A family account already uses that email address." }, { status: 409 });
    }

    console.error("client family account creation failed", error);
    return clientJson({ error: "Could not create family account." }, { status: 500 });
  }
}
