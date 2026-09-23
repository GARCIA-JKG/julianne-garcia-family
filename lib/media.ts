import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const allowedImage = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const allowedVideo = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v"
]);

const allowedAudio = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav"
]);

export type StoredUpload = {
  kind: "photo" | "video" | "audio";
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  bytes: number;
};

export function classifyMime(mime: string): StoredUpload["kind"] | null {
  if (allowedImage.has(mime)) return "photo";
  if (allowedVideo.has(mime)) return "video";
  if (allowedAudio.has(mime)) return "audio";
  return null;
}

function extensionFor(file: File) {
  const fromName = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  if (fromName && fromName.length <= 8) return fromName;

  const fallback: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav"
  };

  return fallback[file.type] ?? "";
}

export async function storeUpload(file: File, memoryId: string): Promise<StoredUpload> {
  const kind = classifyMime(file.type);
  if (!kind) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const maxBytes = kind === "photo" ? 100 * 1024 * 1024 : 2 * 1024 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`File size is not allowed for ${file.name}`);
  }

  const base = process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads";
  const folder = kind === "photo" ? "photos" : kind === "video" ? "videos" : "audio";
  const directory = path.join(base, folder, memoryId);
  await mkdir(directory, { recursive: true });

  const filename = randomUUID() + extensionFor(file);
  const absolutePath = path.join(directory, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes, { flag: "wx" });

  return {
    kind,
    originalFilename: file.name || filename,
    storagePath: absolutePath,
    mimeType: file.type || "application/octet-stream",
    bytes: file.size
  };
}
