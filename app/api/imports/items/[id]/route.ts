import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { verifyAssetTicket } from "@/lib/asset-ticket";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ticket = new URL(request.url).searchParams.get("ticket");
  const ticketPayload = ticket
    ? verifyAssetTicket(ticket, "scan", id)
    : null;

  if (!ticketPayload) {
    await requireRole(["admin", "curator"]);
  }

  const result = await query<{
    storage_path: string;
    mime_type: string;
    original_filename: string;
  }>(
    `SELECT storage_path, mime_type, original_filename
     FROM import_items
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  const item = result.rows[0];
  if (!item) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const uploadRoot = path.resolve(process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads");
  const resolved = path.resolve(item.storage_path);

  if (!resolved.startsWith(uploadRoot + path.sep)) {
    return NextResponse.json({ error: "Scan path rejected." }, { status: 403 });
  }

  const fileStat = await stat(resolved);
  const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": item.mime_type,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.original_filename)}`
    }
  });
}
