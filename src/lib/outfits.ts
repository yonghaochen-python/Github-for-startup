import type { ClothingItem, Outfit, OutfitItem } from "@/generated/prisma/client";
import { orderedLayerEntries } from "@/lib/layering";

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
