import type { ClothingItem, Outfit, OutfitItem } from "@/generated/prisma/client";

type OutfitWithItems = Outfit & { items: (OutfitItem & { item: ClothingItem })[] };

export function serializeOutfit(outfit: OutfitWithItems) {
  return {
    id: outfit.id,
    rationale: outfit.rationale,
    isFavorite: outfit.isFavorite,
    occasion: outfit.occasion,
    weather: outfit.weather,
    style: outfit.style,
    createdAt: outfit.createdAt,
    items: outfit.items.map((oi) => oi.item),
  };
}
