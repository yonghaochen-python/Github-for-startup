import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import type { ImageBytes } from "@/lib/tryOn/types";

/**
 * The person's saved full-body try-on photo. It lives in the same bucket as closet photos but under a
 * private prefix that the public /uploads route refuses to serve; the only way to read it is
 * GET /api/me/photo, which checks the signed-in owner. User.selfieUrl holds the storage key.
 */
const PRIVATE_PREFIX = "private/photos/";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function isPrivateStorageKey(key: string): boolean {
  return key.startsWith("private/");
}

/** True for a photo saved by this feature (older versions stored a public /uploads/... path instead). */
export function isSavedPhotoKey(selfieUrl: string | null): selfieUrl is string {
  return Boolean(selfieUrl?.startsWith(PRIVATE_PREFIX));
}

/** A short, non-secret token that changes whenever the photo is replaced, used to refresh cached previews. */
export function photoVersion(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1).split(".")[0].slice(0, 12);
}

export async function savePersonalPhoto(userId: string, photo: ImageBytes): Promise<string> {
  const ext = EXT_BY_MIME[photo.mediaType];
  if (!ext) throw new Error(`Unsupported photo type: ${photo.mediaType}`);
  const key = `${PRIVATE_PREFIX}${userId}/${randomUUID()}.${ext}`;
  await env.UPLOADS.put(key, photo.bytes, { httpMetadata: { contentType: photo.mediaType } });
  return key;
}

export async function loadPersonalPhoto(key: string): Promise<ImageBytes | null> {
  const object = await env.UPLOADS.get(key);
  if (!object) return null;
  return {
    bytes: new Uint8Array(await object.arrayBuffer()),
    mediaType: object.httpMetadata?.contentType ?? "image/jpeg",
  };
}

export async function deletePersonalPhoto(key: string): Promise<void> {
  await env.UPLOADS.delete(key);
}

/**
 * The person's current look: the latest try-on result, kept (privately, like the photo) so it stays on their
 * photo across the app until they try something else, take it off, or change their photo. One per person, at a
 * fixed key; which outfit it shows and a refresh token live in the object's metadata, so no database column is needed.
 */
const lookKey = (userId: string) => `private/looks/${userId}`;

export type CurrentLook = { version: string; outfitId: string };

export async function saveCurrentLook(userId: string, outfitId: string, imageDataUrl: string): Promise<CurrentLook | null> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) return null;
  const look = { version: randomUUID().slice(0, 12), outfitId };
  await env.UPLOADS.put(lookKey(userId), Buffer.from(match[2], "base64"), {
    httpMetadata: { contentType: match[1] },
    customMetadata: look,
  });
  return look;
}

export async function getCurrentLook(userId: string): Promise<CurrentLook | null> {
  const head = await env.UPLOADS.head(lookKey(userId));
  const meta = head?.customMetadata;
  return meta?.version && meta.outfitId ? { version: meta.version, outfitId: meta.outfitId } : null;
}

export async function loadCurrentLook(userId: string): Promise<ImageBytes | null> {
  return loadPersonalPhoto(lookKey(userId));
}

export async function clearCurrentLook(userId: string): Promise<void> {
  await env.UPLOADS.delete(lookKey(userId));
}
