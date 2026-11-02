/**
 * Personal Style Guide: the report's own part (StudioReportData.extra) and the jewelry materials, drawn by the
 * page (no pictures needed). Shared by the page and the server.
 */

import type { StyledLook } from "@/lib/closetLook";
import type { NotedSwatch } from "@/lib/studioColor";

export const JEWELRY = ["pearl", "jade", "ruby", "sapphire", "diamond", "gold", "silver", "rose_gold"] as const;
export type Jewelry = (typeof JEWELRY)[number];

/** How each material looks on the page: a small rendered stone or metal. */
export const JEWELRY_INFO: Record<Jewelry, { name: string; finish: string }> = {
  pearl: { name: "Pearls", finish: "radial-gradient(circle at 35% 30%, #fffdf6, #ece4d4 55%, #bfb39c)" },
  jade: { name: "Jade", finish: "radial-gradient(circle at 35% 30%, #d6f0d2, #4f9a6a 55%, #1f5a3a)" },
  ruby: { name: "Ruby", finish: "radial-gradient(circle at 35% 30%, #ffb3c0, #c0123a 55%, #5e0418)" },
  sapphire: { name: "Sapphire", finish: "radial-gradient(circle at 35% 30%, #b9cdff, #1f45b8 55%, #0b1d5e)" },
  diamond: { name: "Diamonds", finish: "radial-gradient(circle at 35% 30%, #ffffff, #e3ecf5 45%, #9fb0c2)" },
  gold: { name: "Gold", finish: "radial-gradient(circle at 35% 30%, #fff1b8, #c9a227 55%, #7c5f0d)" },
  silver: { name: "Silver", finish: "radial-gradient(circle at 35% 30%, #ffffff, #c7ccd2 55%, #7d858e)" },
  rose_gold: { name: "Rose gold", finish: "radial-gradient(circle at 35% 30%, #ffe1d6, #d49a86 55%, #8c5546)" },
};

export type JewelryRating = "recommended" | "alternative" | "less";

export type StyleExtra = {
  directions: { name: string; primary: boolean; why: string; keywords: string[] }[];
  topColors: { recommended: NotedSwatch[]; neutral: NotedSwatch[]; lessHarmonious: NotedSwatch[] };
  /** How the top colors interact with their visible coloring. */
  colorNotes: string;
  jewelry: { material: Jewelry; rating: JewelryRating; why: string }[];
  jewelryDirection: string;
  overall: { colorFamilies: string; aesthetic: string; wardrobe: string };
  /** A look from their own closet (swap or take out any piece), when they have clothes. */
  look: StyledLook | null;
};
