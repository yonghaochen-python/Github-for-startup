/**
 * Personal Makeup Guide: the report's own part (StudioReportData.extra). Shared by the page and the server.
 */

import type { NotedSwatch } from "@/lib/studioColor";

export type MakeupExtra = {
  /** Neutral, respectful notes on visible features (never criticism). */
  features: { eyes: string; brows: string; lips: string; proportions: string; undertone: string };
  recommendations: { brows: string; eyes: string; eyeliner: string; blush: string; lips: string; base: string };
  styles: { name: string; best: boolean; why: string }[];
  shades: { eyeshadow: NotedSwatch[]; blush: NotedSwatch[]; lipstick: NotedSwatch[]; brow: NotedSwatch[] };
  direction: string;
};
