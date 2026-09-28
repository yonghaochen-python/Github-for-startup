import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type SavedImage = {
  /** Public URL path, e.g. /uploads/xyz.jpg */
  url: string;
  /** Base64-encoded bytes, for sending straight to Claude's vision API. */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

export async function saveUploadedImage(file: File): Promise<SavedImage> {
  const mediaType = file.type as SavedImage["mediaType"];
  const ext = EXT_BY_MIME[mediaType];
  if (!ext) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return {
    url: `/uploads/${filename}`,
    base64: bytes.toString("base64"),
    mediaType,
  };
}
