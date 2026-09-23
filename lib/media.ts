import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

type MediaKind = "photo" | "video" | "audio";

type ResolvedMediaType = {
  kind: MediaKind;
  mimeType: string;
  extension: string;
};

const mimeTypes: Record<string, ResolvedMediaType> = {
  "image/jpeg": { kind: "photo", mimeType: "image/jpeg", extension: ".jpg" },
  "image/png": { kind: "photo", mimeType: "image/png", extension: ".png" },
  "image/webp": { kind: "photo", mimeType: "image/webp", extension: ".webp" },
  "image/gif": { kind: "photo", mimeType: "image/gif", extension: ".gif" },
  "image/avif": { kind: "photo", mimeType: "image/avif", extension: ".avif" },
  "image/heic": { kind: "photo", mimeType: "image/heic", extension: ".heic" },
  "image/heif": { kind: "photo", mimeType: "image/heif", extension: ".heif" },

  "video/mp4": { kind: "video", mimeType: "video/mp4", extension: ".mp4" },
  "video/quicktime": { kind: "video", mimeType: "video/quicktime", extension: ".mov" },
  "video/webm": { kind: "video", mimeType: "video/webm", extension: ".webm" },
  "video/x-m4v": { kind: "video", mimeType: "video/x-m4v", extension: ".m4v" },

  "audio/webm": { kind: "audio", mimeType: "audio/webm", extension: ".webm" },
  "audio/ogg": { kind: "audio", mimeType: "audio/ogg", extension: ".ogg" },
  "audio/mpeg": { kind: "audio", mimeType: "audio/mpeg", extension: ".mp3" },
  "audio/mp4": { kind: "audio", mimeType: "audio/mp4", extension: ".m4a" },
  "audio/wav": { kind: "audio", mimeType: "audio/wav", extension: ".wav" },
  "audio/x-wav": { kind: "audio", mimeType: "audio/wav", extension: ".wav" }
};

const extensionTypes: Record<string, ResolvedMediaType> = {
  ".jpg": mimeTypes["image/jpeg"],
  ".jpeg": mimeTypes["image/jpeg"],
  ".png": mimeTypes["image/png"],
  ".webp": mimeTypes["image/webp"],
  ".gif": mimeTypes["image/gif"],
  ".avif": mimeTypes["image/avif"],
  ".heic": mimeTypes["image/heic"],
  ".heif": mimeTypes["image/heif"],

  ".mp4": mimeTypes["video/mp4"],
  ".mov": mimeTypes["video/quicktime"],
  ".m4v": mimeTypes["video/x-m4v"],
  ".webm": mimeTypes["video/webm"],

  ".mp3": mimeTypes["audio/mpeg"],
  ".m4a": mimeTypes["audio/mp4"],
  ".ogg": mimeTypes["audio/ogg"],
  ".wav": mimeTypes["audio/wav"]
};

export type StoredUpload = {
  kind: MediaKind;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  bytes: number;
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return new TextDecoder("ascii").decode(bytes.slice(start, start + length));
}

function is(bytes: Uint8Array, values: number[], offset = 0) {
  return values.every((value, index) => bytes[offset + index] === value);
}

async function sniffMediaType(file: File): Promise<ResolvedMediaType | null> {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());

  if (is(bytes, [0xff, 0xd8, 0xff])) return mimeTypes["image/jpeg"];
  if (is(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return mimeTypes["image/png"];
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return mimeTypes["image/gif"];
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return mimeTypes["image/webp"];
  }
  if (is(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    const ext = path.extname(file.name).toLowerCase();
    return ext === ".webm" && file.type.startsWith("audio/")
      ? mimeTypes["audio/webm"]
      : mimeTypes["video/webm"];
  }
  if (ascii(bytes, 0, 4) === "OggS") return mimeTypes["audio/ogg"];
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return mimeTypes["audio/wav"];
  }
  if (
    ascii(bytes, 0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return mimeTypes["audio/mpeg"];
  }

  if (ascii(bytes, 4, 4) === "ftyp") {
    const brands = ascii(bytes, 8, 48).toLowerCase();
    const primaryBrand = ascii(bytes, 8, 4).toLowerCase();

    if (brands.includes("avif") || brands.includes("avis")) {
      return mimeTypes["image/avif"];
    }

    if (
      brands.includes("heic") ||
      brands.includes("heix") ||
      brands.includes("hevc") ||
      brands.includes("hevx") ||
      brands.includes("heif") ||
      brands.includes("mif1") ||
      brands.includes("msf1")
    ) {
      return primaryBrand === "mif1"
        ? mimeTypes["image/heif"]
        : mimeTypes["image/heic"];
    }

    if (
      primaryBrand === "m4a " ||
      primaryBrand === "m4b " ||
      path.extname(file.name).toLowerCase() === ".m4a"
    ) {
      return mimeTypes["audio/mp4"];
    }

    if (primaryBrand === "qt  " || path.extname(file.name).toLowerCase() === ".mov") {
      return mimeTypes["video/quicktime"];
    }

    return mimeTypes["video/mp4"];
  }

  return null;
}

async function resolveMediaType(file: File): Promise<ResolvedMediaType | null> {
  const provided = mimeTypes[file.type.toLowerCase()];
  if (provided) return provided;

  const sniffed = await sniffMediaType(file);
  if (sniffed) return sniffed;

  const generic =
    !file.type ||
    file.type === "application/octet-stream" ||
    file.type === "binary/octet-stream";

  if (generic) {
    return extensionTypes[path.extname(file.name).toLowerCase()] ?? null;
  }

  return null;
}

export async function storeUpload(file: File, memoryId: string): Promise<StoredUpload> {
  const resolvedType = await resolveMediaType(file);

  if (!resolvedType) {
    const label = file.type && file.type !== "application/octet-stream"
      ? file.type
      : path.extname(file.name).toLowerCase() || "unknown";
    throw new Error(`Unsupported family media type: ${label}`);
  }

  const maxBytes =
    resolvedType.kind === "photo"
      ? 100 * 1024 * 1024
      : 2 * 1024 * 1024 * 1024;

  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`File size is not allowed for ${file.name}`);
  }

  const base = process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads";
  const folder =
    resolvedType.kind === "photo"
      ? "photos"
      : resolvedType.kind === "video"
        ? "videos"
        : "audio";

  const directory = path.join(base, folder, memoryId);
  await mkdir(directory, { recursive: true });

  const originalExtension = path.extname(file.name).toLowerCase();
  const safeExtension =
    extensionTypes[originalExtension]?.kind === resolvedType.kind
      ? originalExtension
      : resolvedType.extension;

  const filename = randomUUID() + safeExtension;
  const absolutePath = path.join(directory, filename);
  const source = Readable.fromWeb(file.stream() as never);
  const destination = createWriteStream(absolutePath, { flags: "wx", mode: 0o640 });

  await pipeline(source, destination);

  return {
    kind: resolvedType.kind,
    originalFilename: file.name || filename,
    storagePath: absolutePath,
    mimeType: resolvedType.mimeType,
    bytes: file.size
  };
}
