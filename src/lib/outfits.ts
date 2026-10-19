import type { ClothingItem, Outfit, OutfitItem } from "@/generated/prisma/client";
import { orderedLayerEntries, sanitizeLayeredOutfit } from "@/lib/layering";
import { prisma } from "@/lib/prisma";

type OutfitWithItems = Outfit & { items: (OutfitItem & { item: ClothingItem })[] };

/**
 * `items` stays a flat list for callers that don't care about structure (try-on
 * legacy shape, swap logic). `layers` groups the same items by each item's own
 * layeringRole, in outer-to-accessory visual order — derived on read rather than
 * stored, since a garment's layering role belongs to the item, not the outfit.
 */
export function serializeOutfit(outfit: OutfitWithItems) {
  const items = outfit.items.map((oi) => oi.item);
  return {
    id: outfit.id,
    rationale: outfit.rationale,
    isFavorite: outfit.isFavorite,
    occasion: outfit.occasion,
    weather: outfit.weather,
    style: outfit.style,
    createdAt: outfit.createdAt,
    items,
    layers: orderedLayerEntries(items),
  };
}

const MAX_PIECES = 12;

/** Ids of the person's own closet pieces, in a valid combination (no bottom with a one-piece), or null if any isn't theirs. */
export async function ownedPieces(userId: string, value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PIECES) return null;
  const ids = [...new Set(value.filter((v): v is string => typeof v === "string"))];
  const items = await prisma.clothingItem.findMany({ where: { id: { in: ids }, userId } });
  if (items.length !== ids.length) return null;
  return sanitizeLayeredOutfit(items);
}

