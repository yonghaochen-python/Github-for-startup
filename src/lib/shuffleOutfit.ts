import type { ClothingItem } from "@/components/OutfitCard";

const pickOne = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];
const chance = (p: number) => Math.random() < p;

/**
 * A random outfit from the person's closet, following the layering rules: a dress, or a top with a bottom; sometimes
 * a layer over it; shoes; sometimes an accessory. Runs on the device (no AI, no cost), so it can be tapped forever.
 * Tries not to repeat the look already on screen.
 */
export function shuffleOutfit(closet: ClothingItem[], current: ClothingItem[]): ClothingItem[] {
  const of = (role: string) => closet.filter((i) => i.layeringRole === role);
  const currentKey = current.map((p) => p.id).sort().join();
  let outfit: ClothingItem[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const dresses = of("one_piece");
    const tops = [...of("base_layer"), ...of("mid_layer")];
    const bottoms = of("bottom");
    const useDress = dresses.length > 0 && (!tops.length || !bottoms.length || chance(0.3));
    const chosen: (ClothingItem | undefined)[] = [];
    if (useDress) chosen.push(pickOne(dresses));
    else {
      const base = pickOne(of("base_layer"));
      const mid = pickOne(of("mid_layer"));
      // A top: a base layer, a mid layer, or now and then one over the other.
      if (base && mid) chosen.push(...(chance(0.35) ? [base, mid] : [chance(0.5) ? base : mid]));
      else chosen.push(base ?? mid);
      chosen.push(pickOne(bottoms));
    }
    if (chance(0.4)) chosen.push(pickOne(of("outer_layer")));
    chosen.push(pickOne(of("shoes")));
    if (chance(0.3)) chosen.push(pickOne(of("accessory")));
    outfit = chosen.filter((i): i is ClothingItem => Boolean(i));
    if (outfit.map((p) => p.id).sort().join() !== currentKey) break;
  }
  return outfit;
}
