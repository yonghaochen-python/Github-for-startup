"use client";

import { useEffect, useRef, useState } from "react";
import type { ClothingItem } from "@/components/OutfitCard";
import { retryImage } from "@/lib/retryImage";

/** Top layers first, then what's below them: the order the pieces are numbered in. */
const ORDER = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];

const CATEGORY: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
  outfit: "Outfit",
};

/** A short name from the piece's description ("Black ribbed turtleneck sweater, cozy knit" → "Black ribbed turtleneck sweater"). */
const shortName = (d: string) => d.split(/[,;(]/)[0].trim();

/**
 * The mirror's pieces down the left: 01, 02, 03… with a picture, a short name and the category. Tapping one shows
 * Replace (pick another from the closet in its place) and Remove. Changing pieces never calls the AI.
 */
export function MirrorPieces({
  pieces,
  replacing,
  onReplace,
  onRemove,
  className = "",
}: {
  pieces: ClothingItem[];
  /** The piece being replaced, if any (marked until a new one is picked). */
  replacing: string | null;
  onReplace: (piece: ClothingItem) => void;
  onRemove: (piece: ClothingItem) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));

  // A tap outside closes the open piece's actions.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <ol ref={list} aria-label="Pieces in this look" className={`flex min-h-0 flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {sorted.map((p, i) => {
        const active = open === p.id;
        const swapping = replacing === p.id;
        return (
          <li key={p.id} className="relative animate-[piece-in_.28s_ease-out] motion-reduce:animate-none">
            <button
              onClick={() => setOpen(active ? null : p.id)}
              aria-expanded={active}
              title={p.description}
              className={`group flex w-full items-center gap-2.5 rounded-[12px] p-1.5 text-left transition-colors ${
                active || swapping ? "bg-[#f1efeb]" : "hover:bg-[#f6f5f2]"
              }`}
            >
              <span className="w-[18px] shrink-0 self-start pt-1 text-[10px] font-bold tracking-widest text-[#29343a]">{String(i + 1).padStart(2, "0")}</span>
              <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[#f4f3f0] md:h-[72px] md:w-[60px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt=""
                  onError={retryImage}
                  loading="lazy"
                  className={`h-full w-full ${p.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-0.5" : "object-cover"}`}
                />
              </span>
              <span className="min-w-0 flex-1 max-md:hidden">
                <span className="line-clamp-2 text-[12px] font-medium leading-snug text-[#121821]">{shortName(p.description)}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[1.2px] text-[#5d6874]">
                  {swapping ? "Replacing…" : p.id.startsWith("shop-") ? `Shop · ${CATEGORY[p.category] ?? p.category}` : CATEGORY[p.category] ?? p.category}
                </span>
              </span>
            </button>
            {active && (
              <div className="mt-1 flex gap-1.5 pl-[26px] max-md:pl-1">
                <button
                  onClick={() => {
                    setOpen(null);
                    onReplace(p);
                  }}
                  className="rounded-full bg-[#121821] px-3 py-1.5 text-[11.5px] font-semibold text-white"
                >
                  Replace
                </button>
                <button
                  onClick={() => {
                    setOpen(null);
                    onRemove(p);
                  }}
                  className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
