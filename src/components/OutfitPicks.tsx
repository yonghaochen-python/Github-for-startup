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
}: {
  picks: Outfit[];
  /** The pick now in the mirror, if any. */
  activeId: string | null;
  title: string;
  /** A small line or action beside the title (e.g. Shuffle, or New ideas). */
  note?: React.ReactNode;
  onPick: (outfit: Outfit) => void;
}) {
  if (!picks.length) return null;
  return (
    <section aria-label="Top picks">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[26px] leading-tight text-[#121821]">{title}</h2>
        {note}
      </div>
      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {picks.slice(0, 3).map((pick, i) => {
          const active = pick.id === activeId;
          return (
            <li key={pick.id} className="w-[min(72vw,260px)] shrink-0 snap-start sm:w-auto">
              <button
                onClick={() => onPick(pick)}
                aria-pressed={active}
                aria-label={`Pick ${i + 1}${pick.occasion ? `: ${pick.occasion}` : ""}`}
                className={`btn-tactile relative block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_10px_28px_rgba(18,30,45,0.06)] transition ${
                  active ? "ring-2 ring-[#121821]" : "hover:-translate-y-0.5"
                }`}
              >
                <span
                  className={`absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                    active ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"
                  }`}
                >
                  {i + 1}
                </span>
                <OutfitPreview outfit={pick} className="aspect-[4/5] w-full pt-8" />
                <span className="block border-t border-black/[0.06] px-4 py-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-[1.4px] text-[#5d6874]">
                    {active ? "In your mirror" : pick.occasion ? <span className="capitalize">{pick.occasion}</span> : "Tap to try"}
                  </span>
                  {pick.rationale && <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-[#4f5b66]">{pick.rationale}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
