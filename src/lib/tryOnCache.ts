import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";

/**
 * Remembers every try-on picture made from the saved photo, so trying the same combination again costs nothing.
 * A picture is found by the photo plus the exact pieces, including everything the try-on uses about each piece (its
 * picture, description, color and layer), so a new photo, a different piece or an edited piece makes a new picture.
 * Redo makes a fresh picture that replaces the remembered one. Kept privately; cleared when the photo changes
 * or the account is deleted.
 */

const prefix = (userId: string) => `private/tryon-cache/${userId}/`;

type Piece = { id: string; imageUrl: string; description: string; color: string; layeringRole: string };

export function tryOnCacheKey(userId: string, photoKey: string, pieces: Piece[]): string {
  const sorted = [...pieces]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => [p.id, p.imageUrl, p.description.trim(), p.color.trim(), p.layeringRole]);
  const hash = createHash("sha256").update(JSON.stringify([photoKey, sorted])).digest("hex");
  return `${prefix(userId)}${hash}`;
}

/** The remembered picture as a data URL, or null. */
export async function getCachedTryOn(key: string): Promise<string | null> {
  const object = await env.UPLOADS.get(key);
  if (!object) return null;
  const type = object.httpMetadata?.contentType ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await object.arrayBuffer()).toString("base64")}`;
}

export async function cacheTryOn(key: string, imageDataUrl: string): Promise<void> {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) return;
  await env.UPLOADS.put(key, Buffer.from(match[2], "base64"), { httpMetadata: { contentType: match[1] } });
}

/** Forgets every remembered picture (new photo, or account deleted). */
export async function clearTryOnCache(userId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.UPLOADS.list({ prefix: prefix(userId), cursor });
    if (page.objects.length) await env.UPLOADS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
