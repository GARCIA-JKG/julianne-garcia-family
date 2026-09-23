import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { assertSameOrigin, cleanText, normalizeEmail, validPassword } from "@/lib/security";

export const runtime = "nodejs";

const roles = new Set(["curator", "family", "viewer"]);

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    assertSameOrigin(request);
    const body = await request.json();
    const displayName = cleanText(body.displayName, 120);
    const email = normalizeEmail(cleanText(body.email, 254));
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" && roles.has(body.role) ? body.role : "family";

    if (!displayName || !email.includes("@") || !validPassword(password)) {
      return NextResponse.json(
        { error: "Enter a name, valid email, and temporary password of at least 12 characters." },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [email, displayName, await hashPassword(password), role]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("user creation failed", error);
    return NextResponse.json({ error: "Could not create family account." }, { status: 500 });
  }
}
