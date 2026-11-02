/**
 * Each report's top picks in plain words: the few things to remember, first, before the details. Used at the top of
 * every report and (the first two) on the AI Stylist page's cards. Shared by the page and the server.
 */

import type { ColorExtra } from "@/lib/studioColor";
import type { HairExtra } from "@/lib/studioHair";
import type { MakeupExtra } from "@/lib/studioMakeup";
import type { StudioModuleId, StudioReportData, Swatch } from "@/lib/studioModules";
import { JEWELRY_INFO, type StyleExtra } from "@/lib/studioStyle";

export type Pick = {
  label: string;
  /** Plain words (a name, or a short list). */
  value?: string;
  swatches?: Swatch[];
  /** Something to go easy on, rather than to choose. */
  skip?: boolean;
};

const swatches = (list: Swatch[] | undefined, max: number) => (list ?? []).slice(0, max).map(({ name, hex }) => ({ name, hex }));
const join = (list: string[]) => list.filter(Boolean).join(", ");

export function topPicks(module: StudioModuleId, data: StudioReportData): Pick[] {
  if (!data.extra) return [{ label: "In short", value: data.headline }];
  switch (module) {
    case "color": {
      const x = data.extra as ColorExtra;
      return [
        { label: "Your season", value: x.secondary ? `${x.primary.subtype} (also close to ${x.secondary.subtype})` : x.primary.subtype },
        { label: "Wear these near your face", swatches: swatches(x.groups.clothing, 5) },
        { label: "Your best neutrals", swatches: swatches(x.groups.neutrals, 4) },
        { label: "Go easy on near your face", swatches: swatches(x.groups.lessHarmonious, 4), skip: true },
      ];
    }
    case "style": {
      const x = data.extra as StyleExtra;
      const named = (rating: string) => join(x.jewelry.filter((j) => j.rating === rating).map((j) => JEWELRY_INFO[j.material].name));
      return [
        { label: "Your style", value: join(x.directions.slice(0, 2).map((d) => d.name)) },
        { label: "Best top colors", swatches: swatches(x.topColors.recommended, 4) },
        { label: "Jewelry to choose", value: named("recommended") },
        { label: "Go easy on", value: named("less") || undefined, swatches: swatches(x.topColors.lessHarmonious, 3), skip: true },
      ];
    }
    case "makeup": {
      const x = data.extra as MakeupExtra;
      return [
        { label: "Your makeup style", value: x.styles[0]?.name },
        { label: "Lips", swatches: swatches(x.shades.lipstick, 3) },
        { label: "Blush", swatches: swatches(x.shades.blush, 2) },
        { label: "Eyes", swatches: swatches(x.shades.eyeshadow, 3) },
      ];
    }
    case "hair": {
      const x = data.extra as HairExtra;
      const options = (rating: string) => join(x.styles.filter((s) => s.rating === rating).map((s) => s.option));
      return [
        { label: "Your best hairstyle", value: x.final.style },
        { label: "Best hair color", value: x.final.color, swatches: swatches(x.colors.filter((c) => c.rating === "recommended"), 3) },
        { label: "Also try", value: options("recommended") },
        { label: "Go easy on", value: options("less") || undefined, swatches: swatches(x.colors.filter((c) => c.rating === "less"), 2), skip: true },
      ];
    }
  }
}
