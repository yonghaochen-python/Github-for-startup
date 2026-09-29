import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<string, SavedImage["mediaType"]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `${randomUUID()}.${ext}`;

  await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: mediaType } });

  return {
    url: `/uploads/${key}`,
    base64: Buffer.from(bytes).toString("base64"),
    mediaType,
  };
}

/** Re-reads a previously saved image (by its public URL) for re-classification. */
export async function loadSavedImage(url: string): Promise<SavedImage> {
  const key = url.replace(/^\/uploads\//, "");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MIME_BY_EXT[ext];
  if (!mediaType) {
    throw new Error(`Unsupported image type for ${url}`);
  }

  const object = await env.UPLOADS.get(key);
  if (!object) {
    throw new Error(`Image not found in storage: ${url}`);
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  return { url, base64: Buffer.from(bytes).toString("base64"), mediaType };
}
