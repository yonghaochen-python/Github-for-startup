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

/**
 * How cold the month usually is (northern hemisphere): December–February cold, March and November cool, April and
 * October crisp, May and September mild, June–August warm. The dressing rules below follow it.
 */
type Climate = "cold" | "cool" | "crisp" | "mild" | "warm";
function climateOf(date: string): Climate {
  const m = Number(date.slice(5, 7));
  return m === 12 || m <= 2 ? "cold" : m === 3 || m === 11 ? "cool" : m === 4 || m === 10 ? "crisp" : m === 5 || m === 9 ? "mild" : "warm";
}
/** How often a layer goes over the top (when the rules don't already require one). */
const OUTER: Record<Climate, number> = { cold: 1, cool: 0.8, crisp: 0.5, mild: 0.2, warm: 0.05 };

/* What a piece is, read from its kind, warmth, season tag and description (all saved when it was added). */
const text = (p: PlanPiece) => `${p.description} ${p.category}`.toLowerCase();
/** Tights, pantyhose, stockings: worn under a skirt or dress, never as the bottom on their own. */
const isLegwear = (p: PlanPiece) => /tights|pantyhose|stocking|hosiery/.test(text(p));
const isShorts = (p: PlanPiece) => p.layeringRole === "bottom" && /shorts|skort/.test(text(p));
/** Skirts, shorts and dresses (not jumpsuits or overalls) leave the legs bare. */
const isBareLegs = (p: PlanPiece) =>
  (p.layeringRole === "bottom" && /skirt|shorts|skort/.test(text(p))) || (p.layeringRole === "one_piece" && !/jumpsuit|overall|boiler|pant/.test(text(p)));
const isOpenShoe = (p: PlanPiece) => p.layeringRole === "shoes" && /sandal|flip.?flop|slide|espadrille|thong/.test(text(p));
const isBoot = (p: PlanPiece) => p.layeringRole === "shoes" && /boot/.test(text(p));
const isSummerOnly = (p: PlanPiece) => (p.season || "").toLowerCase() === "summer" || /straw|sundress|thin strap|spaghetti/.test(text(p));
const isWinterOnly = (p: PlanPiece) => (p.season || "").toLowerCase() === "winter";
const warmthOf = (p: PlanPiece) => (p.warmth || "medium").toLowerCase();
/** A warm layer: a coat, puffer or jacket that's medium or high warmth. */
const isWarmOuter = (p: PlanPiece) => p.layeringRole === "outer_layer" && warmthOf(p) !== "low";

/** Pieces that don't belong in this kind of month at all (so they're never picked). */
function allowed(p: PlanPiece, climate: Climate, hasLegwear: boolean): boolean {
  switch (climate) {
    case "cold":
      // No shorts, sandals or summer pieces; skirts and dresses only when there are tights to wear with them.
      return !isShorts(p) && !isOpenShoe(p) && !isSummerOnly(p) && (!isBareLegs(p) || hasLegwear);
    case "cool":
      return !isShorts(p) && !isOpenShoe(p) && !isSummerOnly(p);
    case "crisp":
      return !isShorts(p) && !isOpenShoe(p) && !/straw/.test(text(p));
    case "mild":
      return !isWinterOnly(p);
    case "warm":
      // Nothing heavy: no coats or puffers, chunky knits or boots.
      return !isWinterOnly(p) && warmthOf(p) !== "high" && !isBoot(p) && (p.layeringRole !== "outer_layer" || warmthOf(p) === "low");
  }
}

/**
 * Whether a finished outfit makes sense for the month. Cold: a warm layer always, and bare legs (a skirt or dress)
 * only with tights. Cool: a light top (a tee) or bare legs need a layer over them, and bare legs need tights or boots.
 */
function suits(outfit: PlanPiece[], climate: Climate, closet: PlanPiece[]): boolean {
  const bare = outfit.some(isBareLegs);
  const legwear = outfit.some(isLegwear);
  const outer = outfit.some(isWarmOuter);
  const anyOuter = outfit.some((p) => p.layeringRole === "outer_layer");
  const lightTopOnly =
    !outfit.some((p) => p.layeringRole === "mid_layer" && warmthOf(p) !== "low") && outfit.some((p) => p.layeringRole === "base_layer" || p.layeringRole === "mid_layer");
  const canLayer = closet.some(isWarmOuter);
  if (climate === "cold") return (outer || !canLayer) && (!bare || legwear);
  if (climate === "cool") return (!(bare || lightTopOnly) || anyOuter || !canLayer) && (!bare || legwear || outfit.some(isBoot));
  return true;
}

function seasonFit(p: PlanPiece, season: Season): number {
  const tag = (p.season || "all-season").toLowerCase();
  const fit = tag === "all-season" || tag === season ? 1 : NEXT_TO[season].includes(tag as Season) ? 0.5 : 0.08;
  const warmth = warmthOf(p);
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
 * Makes one outfit for a date: only pieces that suit the month, dressed sensibly for it (a warm layer in cold months,
 * tights with a skirt or dress in winter), leaning to the season, their colors and style, and rotation (pieces worn
 * more this month come up less). Never one of `avoid` (the week's other outfits, or the one shown) unless no other
 * combination turns up; `ranOut` says when that happened, or when the closet has nothing that suits the month.
 */
export function outfitFor(
  date: string,
  closet: PlanPiece[],
  taste: PlanTaste,
  uses: Map<string, number>,
  avoid: Set<string>
): { items: string[]; ranOut: boolean } {
  const season = seasonOf(date);
  const climate = climateOf(date);
  const weight = (i: ClothingItem) => {
    const p = i as PlanPiece;
    const color = taste.palette?.wear.length ? paletteWeight(p.color, taste.palette) : 1;
    return seasonFit(p, season) * color * formalityFit(p, taste.style) / (1 + (uses.get(p.id) ?? 0) * 0.7);
  };
  const legwear = closet.filter(isLegwear);
  const wearable = closet.filter((p) => !isLegwear(p));
  const suited = wearable.filter((p) => allowed(p, climate, legwear.length > 0));
  const warmOuters = suited.filter(isWarmOuter);
  const pickFrom = (list: PlanPiece[]) => {
    const w = list.map((p) => Math.max(0.05, weight(p)));
    let roll = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((roll -= w[i]) <= 0) return list[i];
    return list[list.length - 1];
  };

  /** One try: a picked outfit, finished for the month (a warm layer when it's needed, tights under bare legs). */
  const attempt = (pool: PlanPiece[]): PlanPiece[] => {
    const outfit = shuffleOutfit(pool, [], weight, OUTER[climate]) as PlanPiece[];
    const bare = outfit.some(isBareLegs);
    const needsLayer = climate === "cold" || (climate === "cool" && (bare || !outfit.some((p) => p.layeringRole === "mid_layer" && warmthOf(p) !== "low")));
    if (needsLayer && !outfit.some(isWarmOuter) && warmOuters.length) {
      const coat = pickFrom(warmOuters);
      outfit.splice(0, outfit.length, ...outfit.filter((p) => p.layeringRole !== "outer_layer"), coat);
    }
    if (bare && legwear.length && (climate === "cold" || climate === "cool")) outfit.push(pickFrom(legwear));
    return outfit;
  };

  let repeat: string[] = [];
  for (let tries = 0; tries < 120; tries++) {
    const outfit = attempt(suited);
    if (outfit.length < 2 || !suits(outfit, climate, suited)) continue;
    const ids = outfit.map((p) => p.id);
    if (!avoid.has(outfitKey(ids))) return { items: ids, ranOut: false };
    if (!repeat.length) repeat = ids;
  }
  if (repeat.length) return { items: repeat, ranOut: true };
  // Nothing in the closet suits the month: the closest the whole closet allows.
  const any = attempt(wearable).map((p) => p.id);
  return { items: any.length >= 2 ? any : [], ranOut: true };
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
