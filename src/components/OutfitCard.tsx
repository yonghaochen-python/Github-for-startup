import type { LayeringRole } from "@/lib/layering";

export type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
  layeringRole: LayeringRole;
};

export type OutfitLayer = { role: LayeringRole; items: ClothingItem[] };

export type Outfit = {
  id: string;
  rationale: string;
  isFavorite: boolean;
  occasion: string | null;
  layers: OutfitLayer[];
  /** Refresh token of this outfit's latest try-on picture, if there is one. */
  tryOn?: string | null;
  /** When that try-on picture was made (ISO time). */
  tryOnAt?: string | null;
};

/** Saved looks order: most recently tried on first, then looks never tried on (newest first, as listed). */
export function byLatestTryOn(a: Outfit, b: Outfit) {
  return (b.tryOnAt ?? "").localeCompare(a.tryOnAt ?? "");
}
