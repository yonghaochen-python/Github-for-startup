"use client";

import type { Outfit } from "@/components/OutfitCard";
import { OutfitPreview } from "@/components/OutfitPreview";

/**
 * The Studio's top 3 picks, side by side above the mirror: each shows its pieces numbered and the whole look, so
 * people can compare before choosing one. Tapping a pick puts it in the mirror (trying it on is its own step).
 */
export function OutfitPicks({
  picks,
  activeId,
  title,
  note,
  onPick,
  layout = "row",
  size = "large",
  className = "",
}: {
  picks: Outfit[];
  /** The pick now in the mirror, if any. */
  activeId: string | null;
  title: string;
  /** A small line or action beside the title (e.g. Shuffle, or New ideas). */
  note?: React.ReactNode;
  onPick: (outfit: Outfit) => void;
  /** "row": three cards side by side (below the mirror). "column": stacked small, beside the photo in the mirror. */
  layout?: "row" | "column";
  /** "small": compact swipe cards (phones, under Try On). */
  size?: "large" | "small";
  className?: string;
}) {
  if (!picks.length) return null;
  if (layout === "column") {
    return (
      <section aria-label="Top picks" className={`flex-col gap-2 ${className}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">{title}</h2>
          {note}
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-2">
          {picks.slice(0, 3).map((pick, i) => {
            const active = pick.id === activeId;
            return (
              <li key={pick.id} className="min-h-0 flex-1">
                <button
                  onClick={() => onPick(pick)}
                  aria-pressed={active}
                  aria-label={`Pick ${i + 1}${pick.occasion ? `: ${pick.occasion}` : ""}`}
                  className={`btn-tactile relative block h-full w-full overflow-hidden rounded-[14px] bg-white text-left shadow-[0_6px_18px_rgba(18,30,45,0.07)] transition ${
                    active ? "ring-2 ring-[#121821]" : "ring-1 ring-black/[0.06] hover:-translate-y-0.5"
                  }`}
                >
                  <span
                    className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <OutfitPreview outfit={pick} className="h-full w-full" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  return (
    <section aria-label="Top picks" className={className}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {size === "small" ? (
          <h2 className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">{title}</h2>
        ) : (
          <h2 className="font-display text-[26px] leading-tight text-[#121821]">{title}</h2>
        )}
        {note}
      </div>
      <ul
        className={
          size === "small"
            ? "grid grid-cols-3 gap-2"
            : "-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        }
      >
        {picks.slice(0, 3).map((pick, i) => {
          const active = pick.id === activeId;
          return (
            <li key={pick.id} className={size === "small" ? "min-w-0" : "w-[min(72vw,260px)] shrink-0 snap-start sm:w-auto"}>
              <button
                onClick={() => onPick(pick)}
                aria-pressed={active}
                aria-label={`Pick ${i + 1}${pick.occasion ? `: ${pick.occasion}` : ""}`}
                className={`btn-tactile relative block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_10px_28px_rgba(18,30,45,0.06)] transition ${
                  active ? "ring-2 ring-[#121821]" : "hover:-translate-y-0.5"
                }`}
              >
                <span
                  className={`absolute z-10 flex items-center justify-center rounded-full font-semibold ${size === "small" ? "left-2 top-2 h-6 w-6 text-[11px]" : "left-3 top-3 h-7 w-7 text-[12px]"} ${
                    active ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"
                  }`}
                >
                  {i + 1}
                </span>
                <OutfitPreview outfit={pick} lookOnly={size === "small"} className={`w-full ${size === "small" ? "aspect-[3/4]" : "aspect-[4/5] pt-8"}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
