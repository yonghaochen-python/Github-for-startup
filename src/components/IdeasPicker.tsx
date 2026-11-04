"use client";

import { useEffect } from "react";
import type { Outfit } from "@/components/OutfitCard";
import { OutfitPreview } from "@/components/OutfitPreview";
import { btnPrimary } from "@/components/ui";

/**
 * Style it's outfit ideas side by side before one is used: each shows its pieces numbered and the whole look, and
 * "Use this look" puts it in the mirror. Nothing here costs anything (a try-on is its own step afterwards).
 */
export function IdeasPicker({
  ideas,
  saved,
  styling,
  onPick,
  onNew,
  onClose,
}: {
  ideas: Outfit[];
  /** The ideas came from the same search before (shown free). */
  saved: boolean;
  styling: boolean;
  onPick: (outfit: Outfit) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,16,24,0.55)] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Outfit ideas"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-[1040px] overflow-y-auto rounded-t-[22px] bg-[#f4f5f6] p-5 shadow-[0_24px_60px_rgba(10,16,24,0.3)] sm:rounded-[22px] sm:p-7"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[18px] text-[#29343a] shadow-sm hover:text-[#121821]">
          ×
        </button>
        <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-10">
          <h2 className="font-display text-[30px] leading-tight text-[#121821]">Outfit ideas</h2>
          {saved && (
            <p className="text-[12px] text-[#5d6874]">
              Saved for this search ·{" "}
              <button onClick={onNew} disabled={styling} className="font-semibold text-[#121821] underline underline-offset-4">
                {styling ? "Styling…" : "New ideas"}
              </button>
            </p>
          )}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea, i) => (
            <li key={idea.id} className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(18,30,45,0.06)]">
              <button onClick={() => onPick(idea)} aria-label={`Use idea ${i + 1}`} className="block text-left">
                <OutfitPreview outfit={idea} className="aspect-[4/5] w-full" />
              </button>
              <div className="flex flex-1 flex-col gap-3 border-t border-black/[0.06] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">
                  Idea {i + 1}
                  {idea.occasion ? <span className="capitalize"> · {idea.occasion}</span> : null}
                </p>
                {idea.rationale && <p className="line-clamp-3 text-[12.5px] leading-relaxed text-[#4f5b66]">{idea.rationale}</p>}
                <button onClick={() => onPick(idea)} className={`${btnPrimary} mt-auto self-start`}>
                  Use this look
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
