/**
 * Pure constants/types shared by both server code (classify.ts) and client
 * components (e.g. the closet edit form). Kept separate from classify.ts
 * because that file also imports the Anthropic SDK, which must never end up
 * in a client bundle.
 */
export const CATEGORIES = ["top", "bottom", "outerwear", "shoes", "accessory", "dress"] as const;
export const FORMALITIES = ["casual", "smart-casual", "formal", "athletic"] as const;
export const SEASONS = ["spring", "summer", "fall", "winter", "all-season"] as const;

export type ClothingAttributes = {
  category: (typeof CATEGORIES)[number];
  color: string;
  pattern: string;
  material: string;
  formality: (typeof FORMALITIES)[number];
  season: (typeof SEASONS)[number];
  description: string;
};
