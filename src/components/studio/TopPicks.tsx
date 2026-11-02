"use client";

import type { Pick } from "@/lib/studioPicks";

/** A pick's swatches with their names, small enough to sit in a line. */
export function PickSwatches({ pick, size = "md" }: { pick: Pick; size?: "sm" | "md" }) {
  if (!pick.swatches?.length) return null;
  const dot = size === "sm" ? "h-5 w-5" : "h-9 w-9";
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2">
      {pick.swatches.map((s) => (
        <li key={s.hex + s.name} className="flex items-center gap-1.5">
          <span className={`${dot} shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] ${pick.skip ? "opacity-70" : ""}`} style={{ background: s.hex }} />
          <span className={size === "sm" ? "text-[11.5px] text-[#4f5b66]" : "text-[13px] text-[#2b3540]"}>{s.name}</span>
        </li>
      ))}
    </ul>
  );
}
