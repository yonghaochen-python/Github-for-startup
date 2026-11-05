import type { ColorExtra, NotedSwatch } from "@/lib/studioColor";
import type { HairExtra } from "@/lib/studioHair";
import type { MakeupExtra } from "@/lib/studioMakeup";
import type { StudioModuleId, StudioReportData, Swatch } from "@/lib/studioModules";
import type { Jewelry, StyleExtra } from "@/lib/studioStyle";

/**
 * The Unified Style Profile: one summary of the person's newest AI Stylist reports (colors, makeup, hair, style,
 * jewelry). It's put together from the saved reports each time, so it never calls the AI, needs no table of its own,
 * and works with any number of finished analyses. Shared by the server (which builds it) and the pages.
 */

export type ProfileSource = { module: StudioModuleId; reportId: string; createdAt: string; portraitVersion: string | null };

export type StyleProfile = {
  /** The reports it's made from, newest of each kind. */
  sources: ProfileSource[];
  color?: { season: string; secondary: string | null; undertone: string; best: Swatch[]; neutrals: Swatch[]; avoid: Swatch[] };
  makeup?: { style: string; direction: string; lips: Swatch[]; blush: Swatch[]; eyes: Swatch[] };
  hair?: { style: string; color: string; colors: Swatch[] };
  style?: { direction: string; keywords: string[]; aesthetic: string; wardrobe: string; colors: Swatch[]; avoid: Swatch[] };
  jewelry?: { best: Jewelry[]; also: Jewelry[]; direction: string };
};

const sw = (list: NotedSwatch[] | undefined, n: number): Swatch[] => (list ?? []).slice(0, n).map(({ name, hex }) => ({ name, hex }));

type Row = { id: string; module: string; data: string | null; createdAt: Date; portraitVersion: string | null };

/** Builds the profile from each kind's newest finished report (rows newest first; older ones are skipped). */
export function buildStyleProfile(rows: Row[]): StyleProfile {
  const profile: StyleProfile = { sources: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.module)) continue;
    let data: StudioReportData | null = null;
    try {
      data = row.data ? (JSON.parse(row.data) as StudioReportData) : null;
    } catch {}
    if (!data?.extra) continue;
    seen.add(row.module);
    const module = row.module as StudioModuleId;
    profile.sources.push({ module, reportId: row.id, createdAt: row.createdAt.toISOString(), portraitVersion: row.portraitVersion });

    if (module === "color") {
      const x = data.extra as ColorExtra;
      profile.color = {
        season: x.primary.subtype,
        secondary: x.secondary?.subtype ?? null,
        undertone: x.characteristics.undertone,
        best: sw([...x.groups.clothing, ...x.groups.accents], 8),
        neutrals: sw(x.groups.neutrals, 5),
        avoid: sw(x.groups.lessHarmonious, 4),
      };
    } else if (module === "makeup") {
      const x = data.extra as MakeupExtra;
      profile.makeup = {
        style: x.styles.find((s) => s.best)?.name ?? x.styles[0]?.name ?? data.headline,
        direction: x.direction,
        lips: sw(x.shades.lipstick, 4),
        blush: sw(x.shades.blush, 3),
        eyes: sw(x.shades.eyeshadow, 4),
      };
    } else if (module === "hair") {
      const x = data.extra as HairExtra;
      profile.hair = { style: x.final.style, color: x.final.color, colors: sw(x.colors.filter((c) => c.rating === "recommended"), 4) };
    } else if (module === "style") {
      const x = data.extra as StyleExtra;
      const main = x.directions.find((d) => d.primary) ?? x.directions[0];
      profile.style = {
        direction: main?.name ?? data.headline,
        keywords: (main?.keywords?.length ? main.keywords : data.keywords).slice(0, 5),
        aesthetic: x.overall.aesthetic,
        wardrobe: x.overall.wardrobe,
        colors: sw(x.topColors.recommended, 6),
        avoid: sw(x.topColors.lessHarmonious, 4),
      };
      if (x.jewelry.length) {
        profile.jewelry = {
          best: x.jewelry.filter((j) => j.rating === "recommended").map((j) => j.material),
          also: x.jewelry.filter((j) => j.rating === "alternative").map((j) => j.material),
          direction: x.jewelryDirection,
        };
      }
    }
  }
  return profile;
}

/** The colors to wear, best first: the Style guide's top colors, then the Seasonal Color palette (no repeats). */
export function profileColors(profile: StyleProfile): { wear: Swatch[]; avoid: Swatch[] } {
  const seen = new Set<string>();
  const unique = (list: Swatch[]) => list.filter((s) => !seen.has(s.hex.toUpperCase()) && seen.add(s.hex.toUpperCase()));
  const wear = unique([...(profile.style?.colors ?? []), ...(profile.color?.best ?? []), ...(profile.color?.neutrals ?? [])]);
  const avoid = unique([...(profile.style?.avoid ?? []), ...(profile.color?.avoid ?? [])]);
  return { wear, avoid };
}
