"use client";

import { Checklist, Cover, Panel, Thumb, VerdictRow, Why, shortDay, useRecolored, type Verdict } from "@/components/studio/board";
import { HAIR_DIMENSIONS, type HairExtra, type HairRating } from "@/lib/studioHair";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";
import { topPicks } from "@/lib/studioPicks";

const TO_VERDICT: Record<HairRating, Verdict> = { recommended: "yes", alternative: "ok", less: "no" };
const MARK: Record<HairRating, string> = { recommended: "bg-emerald-500 text-white", alternative: "bg-white text-amber-600 shadow-[inset_0_0_0_1.5px_#f59e0b]", less: "bg-rose-500 text-white" };
const ICON: Record<HairRating, string> = { recommended: "✓", alternative: "○", less: "✕" };

/** The Hair & Color Guide as a board: verdict, hair colors ✓ / ○ / ✗ on your own hair, and each style choice marked. */
export function HairReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as HairExtra;
  const { pictures, of } = useRecolored(portrait, x.colors.map((c) => c.hex), "hair");

  return (
    <div className="flex flex-col gap-4">
      <Cover
        module={module}
        portrait={portrait}
        date={shortDay(createdAt)}
        banner={{ label: "Your best hair", value: x.final.style, line: x.final.color }}
        keywords={data.keywords}
        picks={topPicks("hair", data).slice(1)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel module={module} title="Hair colors on you" note={pictures === null ? "shown as colors (your hair wasn't found)" : "same photo, only the hair changes"}>
          <div className="flex flex-col gap-4">
            {(["recommended", "alternative", "less"] as const).map((r) => {
              const list = x.colors.filter((c) => c.rating === r);
              return list.length ? (
                <VerdictRow key={r} verdict={TO_VERDICT[r]}>
                  {list.map((c) => (
                    <Thumb key={c.hex + c.name} image={of(c.hex)} color={c.hex} label={c.name} sub={c.family} />
                  ))}
                </VerdictRow>
              ) : null;
            })}
          </div>
        </Panel>

        <Panel module={module} title="Hairstyles" note="✓ best · ○ okay · ✕ avoid">
          <ul className="flex flex-col gap-3">
            {HAIR_DIMENSIONS.map((d) => {
              const options = x.styles.filter((s) => s.dimension === d.id);
              if (!options.length) return null;
              return (
                <li key={d.id} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2">
                  <span className="pt-1.5 text-[12px] font-semibold text-[#5d6874]">{d.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {options.map((o) => (
                      <span
                        key={o.option}
                        title={o.effect}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${o.rating === "recommended" ? "bg-[#121821] text-white" : o.rating === "less" ? "bg-[#fbeeee] text-[#9b3a3a] line-through decoration-1" : "bg-[#f1f3f5] text-[#2b3540]"}`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold no-underline ${MARK[o.rating]}`} aria-hidden>
                          {ICON[o.rating]}
                        </span>
                        {o.option}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <Why text={x.styles.filter((s) => s.rating === "recommended").map((s) => `${s.option}: ${s.effect}`).join(" ")} label="How these change your look" />
        </Panel>
      </div>

      <Panel module={module} title="Your hair plan">
        <Checklist module={module} items={[x.final.style, x.final.color]} />
        <Why text={x.final.why} />
        <p className="mt-4 text-[11px] text-[#8a939c]">
          Confidence: {data.confidence}
          {data.limits ? ` · ${data.limits}` : ""} · Pictures of a different haircut aren&apos;t included yet.
        </p>
      </Panel>
    </div>
  );
}
