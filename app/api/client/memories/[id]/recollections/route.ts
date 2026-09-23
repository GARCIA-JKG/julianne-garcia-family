import { randomUUID } from "node:crypto";
import { getBearerUser } from "@/lib/client-auth";
import { clientJson, clientOptions } from "@/lib/client-cors";
import { query } from "@/lib/db";
import { storeUpload } from "@/lib/media";
import { cleanText } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return clientOptions();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getBearerUser(request);

  if (!user) {
    return clientJson({ error: "Please sign in." }, { status: 401 });
  }

  if (user.role === "viewer") {
    return clientJson(
      { error: "This family account has view-only access." },
      { status: 403 }
    );
  }

  try {
    const { id: memoryId } = await params;

    const memory = await query<{ status: string }>(
      "SELECT status FROM memories WHERE id = $1 LIMIT 1",
      [memoryId]
    );

    if (!memory.rows[0] || memory.rows[0].status !== "approved") {
      return clientJson(
        { error: "Recollections can only be added to approved Memories." },
        { status: 409 }
      );
    }

    const form = await request.formData();
    const story = cleanText(form.get("story"), 8000);
    const ageAtMemory = cleanText(form.get("ageAtMemory"), 80);
    const voice = form.get("voice");

    const hasVoice = voice instanceof File && voice.size > 0;

    if (!story && !hasVoice) {
      return clientJson(
        { error: "Write what you remember or record your recollection." },
        { status: 400 }
      );
    }

    const recollectionId = randomUUID();
    let storedVoice:
      | {
          originalFilename: string;
          storagePath: string;
          mimeType: string;
          bytes: number;
        }
      | null = null;

    if (hasVoice) {
      const stored = await storeUpload(
        voice,
        "recollection-" + recollectionId
      );

      if (stored.kind !== "audio") {
        return clientJson(
          { error: "Recollection recording must be audio." },
          { status: 400 }
        );
      }

      storedVoice = {
        originalFilename: stored.originalFilename,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        bytes: stored.bytes
      };
    }

    await query(
      `INSERT INTO recollections (
         id,
         memory_id,
         contributed_by,
         story,
         age_at_memory,
         status,
         voice_original_filename,
         voice_storage_path,
         voice_mime_type,
         voice_bytes
       )
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [
        recollectionId,
        memoryId,
        user.id,
        story || null,
        ageAtMemory || null,
        storedVoice?.originalFilename ?? null,
        storedVoice?.storagePath ?? null,
        storedVoice?.mimeType ?? null,
        storedVoice?.bytes ?? null
      ]
    );

    return clientJson({ ok: true, id: recollectionId });
  } catch (error) {
    console.error("client recollection submission failed", error);
    return clientJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save recollection."
      },
      { status: 500 }
    );
  }
}
