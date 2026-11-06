import type { ClothingItem } from "@/components/OutfitCard";
import { shuffleOutfit } from "@/lib/shuffleOutfit";
import { paletteWeight } from "@/lib/colorMatch";
import type { Swatch } from "@/lib/studioModules";

/**
 * The Planner's outfit maker: free, on the server, no AI. It builds each day from the person's own closet with the
 * same layering rules as Studio's picks, leaning toward pieces that suit the season (their season and warmth
 * tags), their colors and their style (when they have a Style Profile), and rotating pieces so the whole closet
 * gets worn. The same complete outfit never repeats within a Monday–Sunday week while another combination exists.
 */

/** A closet piece with the details the Planner reads (all saved when the piece was added). */
export type PlanPiece = ClothingItem & { color: string; season: string; warmth: string; formality: string };

/** Who set a day's outfit: the Planner, the person keeping a regenerated one, or the person's own edits. */
export type DaySource = "generated" | "chosen" | "edited";
export type PlanDay = { items: string[]; source: DaySource };
export type PlanDays = Record<string, PlanDay>;

export type PlanTaste = {
  palette: { wear: Swatch[]; avoid: Swatch[] } | null;
  /** Their style direction and keywords, in words (from the Style Profile). */
  style: string | null;
};

/** "2026-11" → its dates, "2026-11-01" … "2026-11-30". */
export function datesOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** The Monday that starts this date's week ("2026-11-06" → "2026-11-02"). */
export function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** The months a month's weeks reach into (the one before and after, when its first or last week crosses over). */
export function neighborMonths(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return [shift(-1), shift(1)];
}

/** An outfit's fingerprint: its exact pieces, in any order. */
export const outfitKey = (ids: string[]) => [...ids].sort().join(",");

type Season = "winter" | "spring" | "summer" | "fall";
/** Northern-hemisphere seasons by month. */
function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "fall";
}
const NEXT_TO: Record<Season, Season[]> = { winter: ["fall", "spring"], spring: ["winter", "summer"], summer: ["spring", "fall"], fall: ["summer", "winter"] };
/** How often a layer goes over the top in each season. */
const OUTER: Record<Season, number> = { winter: 0.85, fall: 0.5, spring: 0.4, summer: 0.06 };

function seasonFit(p: PlanPiece, season: Season): number {
  const tag = (p.season || "all-season").toLowerCase();
  const fit = tag === "all-season" || tag === season ? 1 : NEXT_TO[season].includes(tag as Season) ? 0.5 : 0.08;
  const warmth = (p.warmth || "medium").toLowerCase();
  const warm = season === "winter" ? { high: 1.5, medium: 1, low: 0.4 } : season === "summer" ? { high: 0.25, medium: 0.9, low: 1.4 } : { high: 1, medium: 1.2, low: 0.9 };
  return fit * (warm[warmth as keyof typeof warm] ?? 1);
}

/** Style words → the kind of pieces they lean to (a gentle nudge, never a filter). */
function formalityFit(p: PlanPiece, style: string | null): number {
  if (!style) return 1;
  const s = style.toLowerCase();
  const leans = /polish|tailor|classic|elegan|refined|office|old money|minimal/.test(s)
    ? ["smart-casual", "formal"]
    : /sport|athle|active/.test(s)
      ? ["athletic", "casual"]
      : /relax|casual|street|laid|boho/.test(s)
        ? ["casual", "smart-casual"]
        : [];
  return leans.includes((p.formality || "").toLowerCase()) ? 1.5 : 1;
}

/**
 * Makes one outfit for a date: the season, their colors and style, and rotation (pieces worn more often this month
 * come up less). Never one of `avoid` (the week's other outfits, or the one shown) unless no other combination turns
 * up after many tries; `ranOut` says when that happened.
 */
export function outfitFor(
  date: string,
  closet: PlanPiece[],
  taste: PlanTaste,
  uses: Map<string, number>,
  avoid: Set<string>
): { items: string[]; ranOut: boolean } {
  const season = seasonOf(date);
  const weight = (i: ClothingItem) => {
    const p = i as PlanPiece;
    const color = taste.palette?.wear.length ? paletteWeight(p.color, taste.palette) : 1;
    return seasonFit(p, season) * color * formalityFit(p, taste.style) / (1 + (uses.get(p.id) ?? 0) * 0.7);
  };
  let fallback: string[] = [];
  for (let tries = 0; tries < 60; tries++) {
    const ids = shuffleOutfit(closet, [], weight, OUTER[season]).map((p) => p.id);
    if (ids.length < 2) continue;
    if (!fallback.length) fallback = ids;
    if (!avoid.has(outfitKey(ids))) return { items: ids, ranOut: false };
  }
  return { items: fallback, ranOut: fallback.length > 0 };
}

/**
 * Fills a month: every date from `from` on (today, or the 1st of a future month) that isn't one the person chose or
 * edited. Days before `from` and kept days stay as they are. `around` holds the neighboring months' days, so a week
 * that crosses into another month doesn't repeat an outfit either.
 */
export function planMonth(
  month: string,
  from: string,
  closet: PlanPiece[],
  taste: PlanTaste,
  existing: PlanDays,
  around: PlanDays
): { days: PlanDays; ranOut: boolean } {
  const days: PlanDays = {};
  const keep = (date: string) => date < from || existing[date]?.source === "chosen" || existing[date]?.source === "edited";
  for (const [date, day] of Object.entries(existing)) if (keep(date)) days[date] = day;

  const uses = new Map<string, number>();
  for (const day of Object.values(days)) for (const id of day.items) uses.set(id, (uses.get(id) ?? 0) + 1);

  let ranOut = false;
  for (const date of datesOf(month)) {
    if (keep(date)) continue;
    const week = weekOf(date);
    const avoid = new Set(
      Object.entries({ ...around, ...days })
        .filter(([d]) => d !== date && weekOf(d) === week)
        .map(([, day]) => outfitKey(day.items))
    );
    const made = outfitFor(date, closet, taste, uses, avoid);
    if (!made.items.length) continue;
    ranOut ||= made.ranOut;
    days[date] = { items: made.items, source: "generated" };
    for (const id of made.items) uses.set(id, (uses.get(id) ?? 0) + 1);
  }
  return { days, ranOut };
}

/** Reads a stored plan's days, dropping anything malformed and pieces no longer in the closet. */
export function readDays(raw: string | null | undefined, closetIds?: Set<string>): PlanDays {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  const days: PlanDays = {};
  if (!parsed || typeof parsed !== "object") return days;
  for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !value || typeof value !== "object") continue;
    const v = value as { items?: unknown; source?: unknown };
    const items = Array.isArray(v.items) ? v.items.filter((id): id is string => typeof id === "string" && (!closetIds || closetIds.has(id))) : [];
    const source: DaySource = v.source === "edited" || v.source === "chosen" ? v.source : "generated";
    if (items.length) days[date] = { items: items.slice(0, 8), source };
  }
  return days;
}
