"use client";

import type { ClothingItem } from "@/components/OutfitCard";
import { retryImage } from "@/lib/retryImage";

const ORDER = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];

/** A day's pieces as a small flat-lay (up to four, top layers first). */
export function DayFlatLay({ pieces, size = "grid" }: { pieces: ClothingItem[]; size?: "grid" | "row" }) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));
  const img = (p: ClothingItem) => (
    // eslint-disable-next-line @next/next/no-img-element -- the person's own closet pictures
    <img
      key={p.id}
      src={p.imageUrl}
      alt=""
      loading="lazy"
      onError={retryImage}
      className={`h-full w-full ${p.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-0.5" : "object-cover"}`}
    />
  );
  if (size === "row") {
    return (
      <span className="flex min-w-0 gap-1.5 overflow-hidden">
        {sorted.slice(0, 5).map((p) => (
          <span key={p.id} className="h-[72px] w-[58px] shrink-0 overflow-hidden rounded-[10px] bg-white">
            {img(p)}
          </span>
        ))}
      </span>
    );
  }
  const shown = sorted.slice(0, 4);
  return (
    <span className={`grid h-full w-full gap-0.5 ${shown.length > 1 ? "grid-cols-2" : ""} ${shown.length > 2 ? "grid-rows-2" : ""}`}>
      {shown.map((p, i) => (
        <span key={p.id} className={`min-h-0 overflow-hidden rounded-[6px] bg-white ${shown.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          {img(p)}
        </span>
      ))}
    </span>
  );
}
