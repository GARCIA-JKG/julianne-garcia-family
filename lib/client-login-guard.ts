import { createHmac } from "node:crypto";
import { query } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_IP_FAILURES = 12;
const MAX_EMAIL_FAILURES = 8;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required.");
  return value;
}

function fingerprint(value: string) {
  return createHmac("sha256", secret())
    .update(value)
    .digest("hex");
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkClientLoginAllowed(
  request: Request,
  email: string
) {
  const ipHash = fingerprint(clientIp(request));
  const emailHash = fingerprint(email.toLowerCase());

  const result = await query<{
    ip_failures: string;
    email_failures: string;
  }>(
    `SELECT
       count(*) FILTER (
         WHERE ip_hash = $1
           AND succeeded = false
       )::text AS ip_failures,
       count(*) FILTER (
         WHERE email_hash = $2
           AND succeeded = false
       )::text AS email_failures
     FROM client_login_attempts
     WHERE attempted_at >
       now() - ($3 || ' minutes')::interval`,
    [ipHash, emailHash, String(WINDOW_MINUTES)]
  );

  const row = result.rows[0];

  return {
    allowed:
      Number(row?.ip_failures ?? 0) < MAX_IP_FAILURES &&
      Number(row?.email_failures ?? 0) < MAX_EMAIL_FAILURES,
    ipHash,
    emailHash
  };
}

export async function recordClientLoginAttempt(
  ipHash: string,
  emailHash: string,
  succeeded: boolean
) {
  await query(
    `INSERT INTO client_login_attempts (
       ip_hash,
       email_hash,
       succeeded
     )
     VALUES ($1, $2, $3)`,
    [ipHash, emailHash, succeeded]
  );

  if (succeeded) {
    await query(
      `DELETE FROM client_login_attempts
       WHERE email_hash = $1
         AND succeeded = false`,
      [emailHash]
    );
  }

  await query(
    `DELETE FROM client_login_attempts
     WHERE attempted_at < now() - interval '24 hours'`
  );
}
