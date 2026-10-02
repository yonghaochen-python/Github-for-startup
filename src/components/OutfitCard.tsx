import Link from "next/link";
import type { LayeringRole } from "@/lib/layering";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";

export type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
  layeringRole: LayeringRole;
};

export type OutfitLayer = { role: LayeringRole; items: ClothingItem[] };

export type Outfit = {
  id: string;
  rationale: string;
  isFavorite: boolean;
  occasion: string | null;
  layers: OutfitLayer[];
};

/**
 * The shared "curated look" card — same markup on the AI Stylist results,
 * Saved Looks, and the Home showcase, so all three stay visually identical
 * by construction instead of drifting apart one edit at a time.
 */
export function OutfitCard({ outfit, showRationale = true }: { outfit: Outfit; showRationale?: boolean }) {
  const items = outfit.layers.flatMap((layer) => layer.items);
  return (
    <Link
      href={`/outfits/${outfit.id}`}
      className="group block overflow-hidden border border-[#d9dfdf] bg-white transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#c3cbcb] hover:shadow-[0_20px_44px_rgba(20,28,32,0.12)]"
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[1.8px] text-[#9aa2a6]">
            {outfit.occasion ?? "Outfit"}
          </span>
          <h3 className="font-display text-[23px] font-normal leading-none text-[#222a2f]">The Look</h3>
        </div>
        {outfit.isFavorite && (
          <span aria-hidden className="shrink-0 text-sm text-[#354134]">
            ★
          </span>
        )}
      </div>
      <div className="bg-[#f5f6f4]">
        <EditorialOutfitVisual items={items} />
      </div>
      {showRationale && outfit.rationale && (
        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed text-[#737d82]">{outfit.rationale}</p>
        </div>
      )}
    </Link>
  );
}
