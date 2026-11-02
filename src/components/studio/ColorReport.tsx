"use client";

import { Checklist, Cover, Panel, Thumb, VerdictRow, Why, shortDay, useRecolored } from "@/components/studio/board";
import { SEASON_INFO, type ColorExtra } from "@/lib/studioColor";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";
import { topPicks } from "@/lib/studioPicks";

/** The Seasonal Color Analysis as a board: verdict, the four seasons at a glance, and ✓ / ○ / ✗ rows on your photo. */
export function ColorReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as ColorExtra;
  const best = [...x.groups.clothing, ...x.groups.accents].slice(0, 6);
  const okay = x.groups.neutrals.slice(0, 4);
  const avoid = x.groups.lessHarmonious.slice(0, 4);
  // The same photo with only the top recolored, made on the device.
  const { pictures, of } = useRecolored(portrait, [...best, ...okay, ...avoid].map((s) => s.hex), "top");
  const quadrant = ["spring", "summer", "autumn", "winter"] as const;

  return (
    <div className="flex flex-col gap-4">
      <Cover
        module={module}
        portrait={portrait}
        date={shortDay(createdAt)}
        banner={{ label: "Your color type", value: x.primary.subtype, line: x.secondary ? `Also close to ${x.secondary.subtype}` : undefined }}
        keywords={data.keywords}
        picks={topPicks("color", data).slice(1)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* The four seasons */}
        <Panel module={module} title="Your season match">
          <div className="grid grid-cols-2 gap-2">
            {quadrant.map((season) => {
              const s = x.seasons.find((v) => v.season === season);
              const info = SEASON_INFO[season];
              const main = season === x.primary.season;
              return (
                <div key={season} className={`rounded-[14px] p-3 ${main ? "bg-[#121821] text-white" : "bg-[#f4f6f8]"}`}>
                  <p className="text-[13px] font-semibold">
                    {info.name} {main && <span className="text-[11px] font-normal opacity-80">· you</span>}
                  </p>
                  <p className={`text-[10.5px] ${main ? "text-white/70" : "text-[#5d6874]"}`}>{info.feel}</p>
                  <p className="mt-2 font-display text-[30px] leading-none">{s?.score ?? 0}%</p>
                  <div className="mt-2 flex h-2.5 overflow-hidden rounded-full">
                    {info.palette.map((c) => (
                      <span key={c.hex} className="flex-1" style={{ background: c.hex }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Undertone", x.characteristics.undertone],
                ["Depth", x.characteristics.value],
                ["Clarity", x.characteristics.chroma],
                ["Contrast", x.characteristics.contrast],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-[10px] bg-[#f4f6f8] px-1 py-2">
                <dt className="text-[10px] uppercase tracking-[1px] text-[#5d6874]">{k}</dt>
                <dd className="mt-0.5 truncate text-[12px] font-semibold text-[#121821]" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <Why text={x.explanation} label="Why this season?" />
        </Panel>

        {/* ✓ / ○ / ✗ on your photo */}
        <Panel module={module} title="Colors on you" note={pictures === null ? "shown as colors (your top wasn't found)" : "same photo, only the top changes"}>
          <div className="flex flex-col gap-4">
            {(
              [
                ["yes", best],
                ["ok", okay],
                ["no", avoid],
              ] as const
            ).map(([verdict, list]) =>
              list.length ? (
                <VerdictRow key={verdict} verdict={verdict}>
                  {list.map((s) => (
                    <Thumb key={s.hex + s.name} image={of(s.hex)} color={s.hex} label={s.name} />
                  ))}
                </VerdictRow>
              ) : null
            )}
          </div>
          <Why text={data.sections.find((s) => s.title === "How to wear it")?.body ?? ""} label="How to wear them" />
        </Panel>
      </div>

      <Panel module={module} title="In a nutshell">
        <Checklist module={module} items={[data.summary]} />
        <p className="mt-4 text-[11px] text-[#8a939c]">
          Confidence: {data.confidence}
          {data.limits ? ` · ${data.limits}` : ""} · A styling suggestion from one photo, not science.
        </p>
      </Panel>
    </div>
  );
}
