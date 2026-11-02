/**
 * Hair & Color Guide: the report's own part (StudioReportData.extra). Shared by the page and the server.
 */

import type { NotedSwatch } from "@/lib/studioColor";

export type HairRating = "recommended" | "alternative" | "less";

/** The hairstyle choices compared, each a set of options. */
export const HAIR_DIMENSIONS = [
  { id: "length", title: "Length", options: ["Short", "Medium", "Long"] },
  { id: "texture", title: "Texture", options: ["Straight", "Wavy", "Curly"] },
  { id: "bangs", title: "Bangs", options: ["With bangs", "Without bangs"] },
  { id: "parting", title: "Parting", options: ["Center part", "Side part", "Deep side part"] },
  { id: "cut", title: "Cut", options: ["Layered", "Blunt"] },
] as const;
export type HairDimension = (typeof HAIR_DIMENSIONS)[number]["id"];

/** The hair color families compared (plus a few fashion colors the AI may suggest). */
export const HAIR_FAMILIES = ["Black / natural dark brown", "Cool brown", "Warm brown", "Ash brown", "Burgundy"] as const;

export type HairExtra = {
  styles: { dimension: HairDimension; option: string; rating: HairRating; effect: string }[];
  colors: (NotedSwatch & { family: string; rating: HairRating })[];
  final: { style: string; color: string; why: string };
};
