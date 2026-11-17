import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { shuffleOutfit } from "@/lib/shuffleOutfit";
import { paletteWeight } from "@/lib/colorMatch";
import type { Swatch } from "@/lib/studioModules";

export type Palette = { wear: Swatch[]; avoid: Swatch[] };

/**
 * Three free picks made on the device from the closet (not saved outfits; ids start with "pick-"). With a Style
 * Profile, pieces in the person's colors come up more often (their neutrals stay in the mix). No AI, nothing paid.
 */
export function freePicks(closet: ClothingItem[], palette: Palette | null = null): Outfit[] {
  const picks: Outfit[] = [];
  const seen = new Set<string>();
  const weight = palette?.wear.length ? (i: ClothingItem) => paletteWeight((i as { color?: string }).color, palette) : undefined;
  for (let tries = 0; picks.length < 3 && tries < 12; tries++) {
    const items = shuffleOutfit(closet, [], weight);
    const key = items.map((i) => i.id).sort().join();
    if (items.length < 2 || seen.has(key)) continue;
    seen.add(key);
    picks.push({ id: `pick-${tries}-${key}`, rationale: "", isFavorite: false, occasion: null, layers: items.map((i) => ({ role: i.layeringRole, items: [i] })) });
  }
  return picks;
}
