import { createHmac, timingSafeEqual } from "node:crypto";

type AssetKind = "media" | "recollection";

type TicketPayload = {
  kind: AssetKind;
  id: string;
  userId: string;
  exp: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is required for asset tickets.");
  }
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
}

export function createAssetTicket(
  kind: AssetKind,
  id: string,
  userId: string,
  ttlSeconds = 600
) {
  const payload: TicketPayload = {
    kind,
    id,
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return encoded + "." + sign(encoded);
}

export function verifyAssetTicket(
  ticket: string,
  kind: AssetKind,
  id: string
) {
  const [encoded, signature] = ticket.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const givenBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (
    givenBytes.length !== expectedBytes.length ||
    !timingSafeEqual(givenBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TicketPayload;

    if (
      payload.kind !== kind ||
      payload.id !== id ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
