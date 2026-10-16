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
};
