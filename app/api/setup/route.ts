import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { assertSameOrigin, cleanText, normalizeEmail, validPassword } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await request.json();
    const displayName = cleanText(body.displayName, 120);
    const email = normalizeEmail(cleanText(body.email, 254));
    const password = typeof body.password === "string" ? body.password : "";

    if (!displayName || !email.includes("@") || !validPassword(password)) {
      return NextResponse.json(
        { error: "Enter a name, valid email, and password of at least 12 characters." },
        { status: 400 }
      );
    }

    const client = await db.connect();
    let userId = "";

    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE users IN EXCLUSIVE MODE");

      const existing = await client.query(
        "SELECT 1 FROM users WHERE active = true LIMIT 1"
      );

      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Setup has already been completed." },
          { status: 409 }
        );
      }

      const passwordHash = await hashPassword(password);
      const result = await client.query<{ id: string }>(
        `INSERT INTO users (email, display_name, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id`,
        [email, displayName, passwordHash]
      );

      userId = result.rows[0].id;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await createSession(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("setup failed", error);
    return NextResponse.json({ error: "Could not complete setup." }, { status: 500 });
  }
}
