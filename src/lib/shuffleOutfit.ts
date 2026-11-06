import type { ClothingItem } from "@/components/OutfitCard";

/** One at random; with a weight, pieces weighted higher come up more often (never only them). */
function pickOne<T>(list: T[], weight?: (item: T) => number): T | undefined {
  if (!weight || list.length < 2) return list[Math.floor(Math.random() * list.length)];
  const weights = list.map((i) => Math.max(0.05, weight(i)));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((roll -= weights[i]) <= 0) return list[i];
  return list[list.length - 1];
}
const chance = (p: number) => Math.random() < p;

/**
 * A random outfit from the person's closet, following the layering rules: a dress, or a top with a bottom; sometimes
 * a layer over it; shoes; sometimes an accessory. Runs on the device (no AI, no cost), so it can be tapped forever.
 * Tries not to repeat the look already on screen. An optional weight favors some pieces (e.g. the person's colors).
 */
export function shuffleOutfit(
  closet: ClothingItem[],
  current: ClothingItem[],
  weight?: (item: ClothingItem) => number,
  /** How often a layer goes over the top (0–1; 0.4 when not given). The Planner raises it in winter. */
  outerChance = 0.4
): ClothingItem[] {
  const pick = (list: ClothingItem[]) => pickOne(list, weight);
  const of = (role: string) => closet.filter((i) => i.layeringRole === role);
  const currentKey = current.map((p) => p.id).sort().join();
  let outfit: ClothingItem[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const dresses = of("one_piece");
    const tops = [...of("base_layer"), ...of("mid_layer")];
    const bottoms = of("bottom");
    const useDress = dresses.length > 0 && (!tops.length || !bottoms.length || chance(0.3));
    const chosen: (ClothingItem | undefined)[] = [];
    if (useDress) chosen.push(pick(dresses));
    else {
      const base = pick(of("base_layer"));
      const mid = pick(of("mid_layer"));
      // A top: a base layer, a mid layer, or now and then one over the other.
      if (base && mid) chosen.push(...(chance(0.35) ? [base, mid] : [chance(0.5) ? base : mid]));
      else chosen.push(base ?? mid);
      chosen.push(pick(bottoms));
    }
    if (chance(outerChance)) chosen.push(pick(of("outer_layer")));
    chosen.push(pick(of("shoes")));
    if (chance(0.3)) chosen.push(pick(of("accessory")));
    outfit = chosen.filter((i): i is ClothingItem => Boolean(i));
    if (outfit.map((p) => p.id).sort().join() !== currentKey) break;
  }
  return outfit;
}
