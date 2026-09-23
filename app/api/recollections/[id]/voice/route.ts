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
    ? verifyAssetTicket(ticket, "recollection", id)
    : null;

  const user = ticketPayload ? null : await getCurrentUser();

  if (!ticketPayload && !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const privileged =
    user?.role === "admin" || user?.role === "curator";
  const userId = ticketPayload?.userId ?? user?.id ?? null;

  const result = await query<{
    voice_storage_path: string;
    voice_mime_type: string | null;
    voice_original_filename: string | null;
  }>(
    `SELECT
       voice_storage_path,
       voice_mime_type,
       voice_original_filename
     FROM recollections
     WHERE id = $1
       AND voice_storage_path IS NOT NULL
       AND (
         $4::boolean = true
         OR status = 'approved'
         OR contributed_by = $2
         OR $3::boolean = true
       )
     LIMIT 1`,
    [id, userId, privileged, Boolean(ticketPayload)]
  );

  const voice = result.rows[0];
  if (!voice) {
    return NextResponse.json(
      { error: "Voice recollection not found." },
      { status: 404 }
    );
  }

  const uploadRoot = path.resolve(
    process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads"
  );
  const resolved = path.resolve(voice.voice_storage_path);

  if (!resolved.startsWith(uploadRoot + path.sep)) {
    return NextResponse.json(
      { error: "Voice path rejected." },
      { status: 403 }
    );
  }

  const fileStat = await stat(resolved);
  const range = request.headers.get("range");
  const headers = new Headers({
    "Content-Type": voice.voice_mime_type ?? "audio/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
      voice.voice_original_filename ?? "family-recollection"
    )}`
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

    headers.set("Content-Length", String(end - start + 1));
    headers.set(
      "Content-Range",
      `bytes ${start}-${end}/${fileStat.size}`
    );

    const stream = Readable.toWeb(
      createReadStream(resolved, { start, end })
    ) as ReadableStream;

    return new NextResponse(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileStat.size));

  const stream = Readable.toWeb(
    createReadStream(resolved)
  ) as ReadableStream;

  return new NextResponse(stream, { status: 200, headers });
}
