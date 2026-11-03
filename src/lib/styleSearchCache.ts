import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";
import type { ClothingItem } from "@/generated/prisma/client";
import type { OutfitRequest } from "@/lib/generateOutfits";

/**
 * Remembers each Style it search's outfits, per person, so the same search with the same closet is shown again for
 * free instead of asking the AI (and paying) again. The key covers the search and the closet as it is (every piece
 * and its details), so adding, removing or editing a piece makes the next search fresh. Kept privately for 30 days.
 */
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const cacheKey = (userId: string, key: string) => `private/style-searches/${userId}/${key}`;

/** "Old Money!" and "old money" are the same search. */
const normalize = (v: string | undefined) => (v ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function searchKey(userId: string, request: OutfitRequest, closet: ClothingItem[]): Promise<string> {
  const search = [request.theme, request.occasion, request.weather, request.style, request.colorPreference, request.prompt].map(normalize).join("|");
  const pieces = closet
    .map((i) => [i.id, i.category, i.layeringRole, i.warmth, i.color, i.pattern, i.material, i.formality, i.season, i.description].join("~"))
    .sort()
    .join("\n");
  return createHash("sha256").update(`${userId}\n${search}\n${pieces}`).digest("hex").slice(0, 40);
}

/** The outfit ids saved for this search, if they're recent enough. */
export async function readSavedSearch(userId: string, key: string): Promise<string[] | null> {
  const object = await env.UPLOADS.get(cacheKey(userId, key)).catch(() => null);
  if (!object) return null;
  const saved = (await object.json().catch(() => null)) as { at?: number; outfitIds?: string[] } | null;
  if (!saved?.outfitIds?.length || !saved.at || Date.now() - saved.at > KEEP_MS) return null;
  return saved.outfitIds;
}

export async function saveSearch(userId: string, key: string, outfitIds: string[]): Promise<void> {
  await env.UPLOADS.put(cacheKey(userId, key), JSON.stringify({ at: Date.now(), outfitIds }), { httpMetadata: { contentType: "application/json" } });
}

/** Deletes a person's saved searches (with their account). */
export async function deleteSavedSearches(userId: string): Promise<void> {
  const prefix = `private/style-searches/${userId}/`;
  let cursor: string | undefined;
  do {
    const page = await env.UPLOADS.list({ prefix, cursor });
    if (page.objects.length) await env.UPLOADS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
