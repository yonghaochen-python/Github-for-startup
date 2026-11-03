"use client";

import type { ClothingItem } from "@/components/OutfitCard";
import { retryImage } from "@/lib/retryImage";
import type { LayeringRole } from "@/lib/layering";

/** Top layers first, then what's below them, the way an outfit is laid out on a bed. */
const ORDER: LayeringRole[] = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];

/**
 * The outfit itself, for people who'd rather not use a full-body photo: its pieces laid out neatly on one board
 * (clean cut-outs sit whole on the tile; ordinary photos fill it). No AI, no credit.
 */
export function OutfitFlatLay({ pieces, emptyText }: { pieces: ClothingItem[]; emptyText: string }) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));
  if (!sorted.length) {
    return <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[14px] text-[#5d6874]">{emptyText}</p>;
  }
  // The whole outfit always fits the frame: tiles share its height and width.
  const cols = sorted.length <= 1 ? 1 : sorted.length <= 4 ? 2 : 3;
  const rows = Math.ceil(sorted.length / cols);
  return (
    <ul
      className="absolute inset-0 grid gap-3 p-5 pt-14 sm:p-8 sm:pt-16"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {sorted.map((p) => {
        const cutout = p.imageUrl.startsWith("/uploads/cut-");
        return (
          <li key={p.id} className="flex min-h-0 min-w-0 flex-col">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-white shadow-[0_6px_18px_rgba(18,30,45,0.06)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt={p.description}
                onError={retryImage}
                className={`absolute inset-0 h-full w-full ${cutout ? "object-contain p-3 drop-shadow-[0_8px_12px_rgba(18,24,33,0.15)]" : "object-cover"}`}
              />
            </div>
            <p className="mt-1.5 truncate px-1 text-center text-[11.5px] text-[#4f5b66]" title={p.description}>
              {p.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
