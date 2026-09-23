import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import type { CurrentUser, UserRole } from "@/lib/auth";

const SESSION_DAYS = 30;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createBearerSession(userId: string) {
  const token = randomBytes(32).toString("base64url");

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [userId, tokenHash(token), String(SESSION_DAYS)]
  );

  return token;
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function getBearerUser(
  request: Request
): Promise<CurrentUser | null> {
  const token = bearerToken(request);
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
  return user
    ? {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    : null;
}

export async function destroyBearerSession(request: Request) {
  const token = bearerToken(request);
  if (!token) return;

  await query(
    "DELETE FROM sessions WHERE token_hash = $1",
    [tokenHash(token)]
  );
}
