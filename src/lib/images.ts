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

export async function deleteSavedImage(url: string): Promise<void> {
  const key = url.replace(/^\/uploads\//, "");
  await env.UPLOADS.delete(key);
}

/* ---------- Cut-outs (background removed on the person's device) ---------- */

const CUTOUT_PREFIX = "cut-";
const MAX_CUTOUT_BYTES = 8 * 1024 * 1024;

const keyOf = (url: string) => decodeURIComponent(url.replace(/^\/uploads\//, ""));

/** Whether a picture is a cut-out made by "Remove background". */
export const isCutout = (url: string) => url.startsWith("/uploads/") && keyOf(url).startsWith(CUTOUT_PREFIX);

/**
 * Saves a piece's cut-out as a new picture. The original stays where it is (its address is kept with the cut-out), so
 * "Keep background" can always bring it back.
 */
export async function saveCutout(originalUrl: string, file: File): Promise<string> {
  if (file.type !== "image/png" || file.size === 0 || file.size > MAX_CUTOUT_BYTES) throw new Error("bad cutout");
  const key = `${CUTOUT_PREFIX}${randomUUID()}.png`;
  await env.UPLOADS.put(key, new Uint8Array(await file.arrayBuffer()), {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { original: originalUrl },
  });
  return `/uploads/${key}`;
}

/** The original picture a cut-out was made from (null if it isn't a cut-out or the record is missing). */
export async function cutoutOriginal(url: string): Promise<string | null> {
  if (!isCutout(url)) return null;
  const head = await env.UPLOADS.head(keyOf(url));
  return head?.customMetadata?.original ?? null;
}

/** The stored files behind a piece's picture: just the picture, or a cut-out plus the original it was made from. */
export async function pictureKeys(url: string): Promise<string[]> {
  if (!url.startsWith("/uploads/")) return [];
  const original = await cutoutOriginal(url).catch(() => null);
  return [keyOf(url), ...(original?.startsWith("/uploads/") ? [keyOf(original)] : [])];
}
