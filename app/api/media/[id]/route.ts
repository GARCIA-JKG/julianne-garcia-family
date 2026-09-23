import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyAssetTicket } from "@/lib/asset-ticket";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket");
  const ticketPayload = ticket
    ? verifyAssetTicket(ticket, "media", id)
    : null;

  const user = ticketPayload ? null : await getCurrentUser();

  if (!ticketPayload && !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const privileged =
    user?.role === "admin" || user?.role === "curator";
  const userId = ticketPayload?.userId ?? user?.id ?? null;

  const result = await query<{
    storage_path: string;
    mime_type: string | null;
    original_filename: string;
  }>(
    `SELECT md.storage_path, md.mime_type, md.original_filename
       FROM media md
       JOIN memories m ON m.id = md.memory_id
      WHERE md.id = $1
        AND md.archived = false
        AND (
          $4::boolean = true
          OR m.status = 'approved'
          OR m.created_by = $2
          OR $3::boolean = true
        )
      LIMIT 1`,
    [id, userId, privileged, Boolean(ticketPayload)]
  );

  const media = result.rows[0];
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const uploadRoot = path.resolve(process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads");
  const resolved = path.resolve(media.storage_path);
  if (!resolved.startsWith(uploadRoot + path.sep)) {
    return NextResponse.json({ error: "Media path rejected." }, { status: 403 });
  }

  const fileStat = await stat(resolved);
  const range = request.headers.get("range");
  const headers = new Headers({
    "Content-Type": media.mime_type ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(media.original_filename)}`
  });

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) return new NextResponse(null, { status: 416 });

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : fileStat.size - 1;

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      end >= fileStat.size
    ) {
      headers.set("Content-Range", `bytes */${fileStat.size}`);
      return new NextResponse(null, { status: 416, headers });
    }

    const length = end - start + 1;
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);

    const stream = Readable.toWeb(createReadStream(resolved, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileStat.size));
  const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
