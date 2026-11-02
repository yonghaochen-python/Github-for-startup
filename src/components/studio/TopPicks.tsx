"use client";

import type { Pick } from "@/lib/studioPicks";
import type { StudioModule } from "@/lib/studioModules";

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

/** The few things to remember from a report, first and in plain words, before the details. */
export function TopPicks({ module, picks, onDetails }: { module: StudioModule; picks: Pick[]; onDetails: () => void }) {
  return (
    <section className="mb-6 rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(18,30,45,0.08)] sm:p-9" aria-labelledby="top-picks">
      <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
        In short
      </p>
      <h2 id="top-picks" className="mt-2 font-display text-[34px] leading-none text-[#121821] sm:text-[40px]">
        Your top picks
      </h2>
      <ol className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {picks.map((p, i) => (
          <li key={p.label} className="flex gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${p.skip ? "bg-[#f3ece9] text-[#8a5a4a]" : "bg-[#121821] text-white"}`}
              aria-hidden
            >
              {p.skip ? "–" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-semibold uppercase tracking-[1.4px] ${p.skip ? "text-[#8a5a4a]" : "text-[#5d6874]"}`}>{p.label}</p>
              {p.value && <p className="mt-1 font-display text-[22px] leading-snug text-[#121821]">{p.value}</p>}
              {p.swatches?.length ? (
                <div className="mt-2.5">
                  <PickSwatches pick={p} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <button onClick={onDetails} className="mt-7 text-[13px] font-semibold text-[#121821] underline underline-offset-4">
        See why, and compare on your photo ↓
      </button>
    </section>
  );
}
