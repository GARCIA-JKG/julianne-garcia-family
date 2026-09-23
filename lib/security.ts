import { timingSafeEqual } from "node:crypto";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function cleanText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

export function validPassword(password: string) {
  return password.length >= 12 && password.length <= 200;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return;

  const parsed = new URL(origin);
  if (parsed.host !== host) {
    throw new Error("Cross-origin write rejected");
  }
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
