import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

export type UserRole = "admin" | "curator" | "family" | "viewer";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

const COOKIE_NAME = "jgf_session";
const SESSION_DAYS = 30;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [userId, hash, String(SESSION_DAYS)]
  );

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }

  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
  }>(
    `SELECT u.id, u.email, u.display_name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.active = true
      LIMIT 1`,
    [tokenHash(token)]
  );

  const user = result.rows[0];
  if (!user) {
    store.delete(COOKIE_NAME);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (user) return user;

  const exists = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM users WHERE active = true) AS exists"
  );

  redirect(exists.rows[0]?.exists ? "/login" : "/setup");
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
