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
              onClick={() => {
                // Phones: the piece itself is Replace (its ✕ removes it). Computers: show Replace / Remove.
                if (window.matchMedia("(max-width: 767px)").matches) onReplace(p);
                else setOpen(active ? null : p.id);
              }}
              aria-expanded={active}
              aria-label={`${String(i + 1).padStart(2, "0")} ${shortName(p.description)}`}
              title={p.description}
              className={`group flex w-full items-center gap-2.5 rounded-[12px] p-1.5 text-left transition-colors ${
                active || swapping ? "bg-[#f1efeb]" : "hover:bg-[#f6f5f2]"
              }`}
            >
              {/* The number: beside the picture on computers, a small badge on its corner on phones (the column is narrow). */}
              <span className="w-[18px] shrink-0 self-start pt-1 text-[10px] font-bold tracking-widest text-[#29343a] max-md:absolute max-md:bottom-2.5 max-md:left-2.5 max-md:z-10 max-md:w-auto max-md:rounded-full max-md:bg-white/90 max-md:px-1.5 max-md:pt-0 max-md:text-[9px] max-md:leading-[16px] max-md:tracking-wider">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[#f4f3f0] max-md:h-16 max-md:w-full md:h-[72px] md:w-[60px]">
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
            {/* Phones: ✕ on the piece's top-right corner removes it in one tap. */}
            <button
              onClick={() => onRemove(p)}
              aria-label={`Remove ${shortName(p.description)}`}
              title="Remove"
              className="absolute right-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10.5px] text-[#121821] shadow-[0_1px_4px_rgba(18,24,33,0.22)] md:hidden"
            >
              ✕
            </button>
            {active && (
              <div className="mt-1 flex gap-1.5 pl-[26px] max-md:hidden">
                {/* Phones: the column is narrow, so two round icon buttons (⇄ replace, ✕ remove); computers: words. */}
                <button
                  onClick={() => {
                    setOpen(null);
                    onReplace(p);
                  }}
                  aria-label={`Replace ${shortName(p.description)}`}
                  title="Replace"
                  className="flex items-center justify-center rounded-full bg-[#121821] text-[11.5px] font-semibold text-white max-md:h-8 max-md:w-8 md:px-3 md:py-1.5"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 md:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M7 7h11l-3-3M17 17H6l3 3" />
                  </svg>
                  <span className="max-md:hidden">Replace</span>
                </button>
                <button
                  onClick={() => {
                    setOpen(null);
                    onRemove(p);
                  }}
                  aria-label={`Remove ${shortName(p.description)}`}
                  title="Remove"
                  className="flex items-center justify-center rounded-full bg-white text-[11.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] max-md:h-8 max-md:w-8 md:px-3 md:py-1.5"
                >
                  <span aria-hidden className="text-[13px] md:hidden">✕</span>
                  <span className="max-md:hidden">Remove</span>
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
