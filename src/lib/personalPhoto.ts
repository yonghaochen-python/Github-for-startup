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

/**
 * Each outfit's latest try-on picture, so saved looks can show the whole outfit on the person. Private like the
 * photo, one per outfit at a fixed key; a refresh token lives in the object's metadata, so no database column is needed.
 */
const outfitTryOnPrefix = (userId: string) => `private/tryons/${userId}/`;
const outfitTryOnKey = (userId: string, outfitId: string) => `${outfitTryOnPrefix(userId)}${outfitId}`;

export async function saveOutfitTryOn(userId: string, outfitId: string, imageDataUrl: string): Promise<void> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) return;
  await env.UPLOADS.put(outfitTryOnKey(userId, outfitId), Buffer.from(match[2], "base64"), {
    httpMetadata: { contentType: match[1] },
    customMetadata: { version: randomUUID().slice(0, 12) },
  });
}

/** outfitId → refresh token, for every outfit of this person that has a try-on picture. */
export async function listOutfitTryOns(userId: string): Promise<Map<string, string>> {
  const prefix = outfitTryOnPrefix(userId);
  const found = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const page = await env.UPLOADS.list({ prefix, cursor, include: ["customMetadata"] });
    for (const object of page.objects) found.set(object.key.slice(prefix.length), object.customMetadata?.version ?? "1");
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return found;
}

export async function loadOutfitTryOn(userId: string, outfitId: string): Promise<ImageBytes | null> {
  return loadPersonalPhoto(outfitTryOnKey(userId, outfitId));
}

export async function deleteOutfitTryOns(userId: string, outfitIds: string[]): Promise<void> {
  if (outfitIds.length > 0) await env.UPLOADS.delete(outfitIds.map((id) => outfitTryOnKey(userId, id)));
}

export async function deleteAllOutfitTryOns(userId: string): Promise<void> {
  const ids = [...(await listOutfitTryOns(userId)).keys()];
  for (let i = 0; i < ids.length; i += 1000) await deleteOutfitTryOns(userId, ids.slice(i, i + 1000));
}

/** This outfit's try-on picture refresh token, if it has one (taking over the current look the first time). */
export async function outfitTryOnVersion(userId: string, outfitId: string): Promise<string | null> {
  const head = await env.UPLOADS.head(outfitTryOnKey(userId, outfitId));
  if (head) return head.customMetadata?.version ?? "1";
  const look = await getCurrentLook(userId);
  if (look?.outfitId !== outfitId) return null;
  const image = await loadCurrentLook(userId);
  if (!image) return null;
  await saveOutfitTryOn(userId, outfitId, `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}`);
  return (await env.UPLOADS.head(outfitTryOnKey(userId, outfitId)))?.customMetadata?.version ?? null;
}
