/**
 * Seasonal Color Analysis: the shapes, the four seasons' reference palettes (drawn by the page, no AI needed), and
 * how a report's `extra` part is laid out. Shared by the page and the server.
 */

import type { Swatch } from "@/lib/studioModules";

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_INFO: Record<Season, { name: string; feel: string; palette: Swatch[] }> = {
  spring: {
    name: "Spring",
    feel: "Warm, clear and light",
    palette: [
      { name: "Coral", hex: "#F27B5B" },
      { name: "Peach", hex: "#FFB38A" },
      { name: "Buttercup", hex: "#F6C945" },
      { name: "Turquoise", hex: "#30C5B5" },
      { name: "Kelly green", hex: "#4CBB17" },
      { name: "Light camel", hex: "#C8A165" },
    ],
  },
  summer: {
    name: "Summer",
    feel: "Cool, soft and light",
    palette: [
      { name: "Powder blue", hex: "#A7C7E7" },
      { name: "Lavender", hex: "#B8A9D9" },
      { name: "Dusty rose", hex: "#D8A1B0" },
      { name: "Soft teal", hex: "#6FA8A6" },
      { name: "Slate", hex: "#708090" },
      { name: "Mauve", hex: "#B784A7" },
    ],
  },
  autumn: {
    name: "Autumn",
    feel: "Warm, muted and deep",
    palette: [
      { name: "Rust", hex: "#B7410E" },
      { name: "Olive", hex: "#708238" },
      { name: "Mustard", hex: "#D9A404" },
      { name: "Deep teal", hex: "#0F7C7C" },
      { name: "Chocolate", hex: "#5C3A21" },
      { name: "Terracotta", hex: "#C8603F" },
    ],
  },
  winter: {
    name: "Winter",
    feel: "Cool, clear and high-contrast",
    palette: [
      { name: "True red", hex: "#C8102E" },
      { name: "Emerald", hex: "#046307" },
      { name: "Royal blue", hex: "#2E5AAC" },
      { name: "Black", hex: "#111111" },
      { name: "Optic white", hex: "#FAFAFA" },
      { name: "Fuchsia", hex: "#D1349B" },
    ],
  },
};

export type NotedSwatch = Swatch & { note?: string };

/** The color report's own part (StudioReportData.extra). */
export type ColorExtra = {
  seasons: { season: Season; score: number; note: string }[];
  primary: { season: Season; subtype: string };
  secondary: { season: Season; subtype: string } | null;
  characteristics: { undertone: string; value: string; chroma: string; contrast: string };
  explanation: string;
  groups: { clothing: NotedSwatch[]; neutrals: NotedSwatch[]; accents: NotedSwatch[]; lessHarmonious: NotedSwatch[] };
};

export const isHex = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex);
