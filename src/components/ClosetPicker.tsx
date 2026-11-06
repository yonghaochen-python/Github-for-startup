"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClothingItem } from "@/components/OutfitCard";
import { retryImage } from "@/lib/retryImage";
import { COLOR_FAMILIES, colorFamilies, paletteWeight, type ColorFamily } from "@/lib/colorMatch";
import type { Swatch } from "@/lib/studioModules";

export type Palette = { wear: Swatch[]; avoid: Swatch[] };
export type ColorChoice = ColorFamily | "yours" | null;

export const CLOSET_TABS = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

const colorOf = (item: ClothingItem) => (item as { color?: string }).color;

/** Whether a piece passes the color filter: a color family, or "yours" (the Style Profile's colors). */
export function matchesColor(item: ClothingItem, choice: ColorChoice, palette: Palette | null | undefined): boolean {
  if (!choice) return true;
  if (choice === "yours") return Boolean(palette?.wear.length) && paletteWeight(colorOf(item), palette!) >= 1.6;
  return colorFamilies(colorOf(item)).includes(choice);
}

/**
 * The color filter row (Studio and the Planner): All, Your colors (with a Style Profile), and a dot for each color
 * family these pieces come in. Shown only when there's more than one family to choose from.
 */
export function ColorFilter({
  pieces,
  value,
  onChange,
  palette,
}: {
  pieces: ClothingItem[];
  value: ColorChoice;
  onChange: (next: ColorChoice) => void;
  palette: Palette | null | undefined;
}) {
  const families = COLOR_FAMILIES.filter((f) => pieces.some((item) => colorFamilies(colorOf(item)).includes(f.id)));
  if (families.length < 2) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-black/[0.06] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter by color">
      <button
        onClick={() => onChange(null)}
        aria-pressed={!value}
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${!value ? "bg-[#121821] text-white" : "text-[#5d6874] hover:text-[#121821]"}`}
      >
        All
      </button>
      {Boolean(palette?.wear.length) && (
        <button
          onClick={() => onChange(value === "yours" ? null : "yours")}
          aria-pressed={value === "yours"}
          title="Pieces in your colors (from your Style Profile)"
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            value === "yours" ? "bg-[#121821] text-white" : "bg-[#f1efeb] text-[#121821]"
          }`}
        >
          <span className="flex -space-x-1" aria-hidden>
            {palette!.wear.slice(0, 3).map((c) => (
              <span key={c.hex} className="h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: c.hex }} />
            ))}
          </span>
          Your colors
        </button>
      )}
      {families.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(value === f.id ? null : f.id)}
          aria-pressed={value === f.id}
          aria-label={f.label}
          title={f.label}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${value === f.id ? "ring-2 ring-[#121821] ring-offset-1" : ""}`}
        >
          <span className="h-5 w-5 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.15)]" style={{ background: f.dot }} />
        </button>
      ))}
    </div>
  );
}

/**
 * My Closet as a picker: the kinds as tabs, the color filter, and the pieces. A tap picks a piece (chosen ones are
 * ticked). The open tab can be set from outside (Replace opens the piece's own kind).
 */
export function ClosetPicker({
  closet,
  chosen,
  onPick,
  palette,
  tab,
  onTab,
}: {
  closet: ClothingItem[];
  chosen: Set<string>;
  onPick: (item: ClothingItem) => void;
  palette: Palette | null | undefined;
  tab: string;
  onTab: (tab: string) => void;
}) {
  const [color, setColor] = useState<{ tab: string; value: ColorChoice }>({ tab, value: null });
  // A new kind of piece starts unfiltered.
  const filter = color.tab === tab ? color.value : null;
  const kind = closet.filter((item) => item.category === tab);
  const shown = kind.filter((item) => matchesColor(item, filter, palette));

  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" aria-label="Closet sections" className="flex flex-wrap border-b border-black/[0.06] px-2.5 pt-3">
        {CLOSET_TABS.map((t) => {
          const active = t.value === tab;
          const count = closet.filter((item) => item.category === t.value && chosen.has(item.id)).length;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.value)}
              className={`relative shrink-0 px-2 pb-3 pt-1 text-[13px] ${
                active ? "font-semibold text-[#121821] after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#121821]" : "text-[#5d6874] hover:text-[#121821]"
              }`}
            >
              {t.label}
              {count > 0 && <span className="ml-1 text-[11px] text-[#d93a2b]">•</span>}
            </button>
          );
        })}
      </div>
      <ColorFilter pieces={kind} value={filter} onChange={(value) => setColor({ tab, value })} palette={palette} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-[13px] text-[#5d6874]">
            Nothing here yet.{" "}
            <Link href="/closet?add=1" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
              Add clothes
            </Link>
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {shown.map((item) => {
              const picked = chosen.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onPick(item)}
                    aria-pressed={picked}
                    title={item.description}
                    className={`group relative block aspect-square w-full overflow-hidden rounded-[14px] bg-[#f4f5f6] ${
                      picked ? "shadow-[inset_0_0_0_2px_#121821]" : "hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.2)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- the person's own closet pictures */}
                    <img
                      src={item.imageUrl}
                      alt={item.description}
                      loading="lazy"
                      onError={retryImage}
                      className={`absolute inset-0 h-full w-full ${item.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-1" : "object-cover"}`}
                    />
                    {picked && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-white">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                          <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#4f5b66]">{item.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
