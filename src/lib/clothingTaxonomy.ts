/**
 * Pure constants/types shared by both server code (classify.ts) and client
 * components (e.g. the closet edit form). Kept separate from classify.ts
 * because that file also imports the Anthropic SDK, which must never end up
 * in a client bundle.
 */
export const CATEGORIES = ["top", "bottom", "outerwear", "shoes", "accessory", "dress"] as const;
export const FORMALITIES = ["casual", "smart-casual", "formal", "athletic"] as const;
export const SEASONS = ["spring", "summer", "fall", "winter", "all-season"] as const;

/**
 * Where a garment sits when an outfit is layered, independent of `category` — e.g. a
 * cardigan and a jacket are both `category: "outerwear"`-ish tops, but a cardigan is a
 * mid_layer (worn under a jacket) while a jacket is the outer_layer.
 */
export const LAYERING_ROLES = [
  "base_layer",
  "mid_layer",
  "outer_layer",
  "bottom",
  "one_piece",
  "shoes",
  "accessory",
] as const;

export const WARMTH_LEVELS = ["low", "medium", "high"] as const;

export type ClothingAttributes = {
  category: (typeof CATEGORIES)[number];
  layeringRole: (typeof LAYERING_ROLES)[number];
  warmth: (typeof WARMTH_LEVELS)[number];
  color: string;
  pattern: string;
  material: string;
  formality: (typeof FORMALITIES)[number];
  season: (typeof SEASONS)[number];
  description: string;
};
