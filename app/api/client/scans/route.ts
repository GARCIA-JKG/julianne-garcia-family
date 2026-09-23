import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { listScanBatches } from "@/lib/imports";
import { cleanText } from "@/lib/security";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

function allowed(role: string) {
  return role === "admin" || role === "curator";
}

export async function GET(request: Request) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!allowed(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  return clientJson({ batches: await listScanBatches() });
}

export async function POST(request: Request) {
  const user = await getBearerUser(request);
  if (!user) return clientJson({ error: "Please sign in." }, { status: 401 });
  if (!allowed(user.role)) return clientJson({ error: "Curator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const name = cleanText(body.name, 160);
    const source = cleanText(body.source, 200);
    const notes = cleanText(body.notes, 500);

    if (!name) {
      return clientJson({ error: "Batch name is required." }, { status: 400 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO import_batches (name, source, notes, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, source || null, notes || null, user.id]
    );

    return clientJson({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("client create scan batch failed", error);
    return clientJson({ error: "Could not create scan batch." }, { status: 500 });
  }
}
