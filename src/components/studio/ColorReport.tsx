"use client";

import { useState } from "react";
import { SEASON_INFO, isHex, type ColorExtra, type NotedSwatch } from "@/lib/studioColor";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";

const label = "text-[11px] font-medium uppercase tracking-[2.6px] text-[#5d6874]";
const longDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * The portrait with a color "draped" under the face, the way color analysts hold fabric up to someone. Drawn by the
 * page over the photo (nothing is generated), so the face, hair and light stay exactly as they are.
 */
function Drape({ portrait, color, className = "" }: { portrait: string | null; color: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#e9edf1] ${className}`}>
      {portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portrait} alt="" className="h-full w-full object-cover" />
      )}
      <div
        className="absolute inset-x-[-10%] bottom-[-6%] h-[30%] shadow-[0_-6px_18px_rgba(0,0,0,0.18)] transition-colors duration-300"
        style={{ background: color, borderRadius: "50% 50% 0 0 / 38% 38% 0 0" }}
      />
    </div>
  );
}

function SwatchList({ title, swatches, onPick, picked }: { title: string; swatches: NotedSwatch[]; onPick: (s: NotedSwatch) => void; picked: string }) {
  if (!swatches.length) return null;
  return (
    <div>
      <p className={`${label} mb-4`}>{title}</p>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
        {swatches.map((s) => (
          <li key={`${title}${s.hex}`}>
            <button onClick={() => onPick(s)} className="group flex w-full flex-col items-start gap-1.5 text-left" aria-label={`Drape ${s.name}`}>
              <span
                className={`h-14 w-14 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.1)] transition-transform group-hover:scale-[1.04] sm:h-16 sm:w-16 ${picked === s.hex ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
                style={{ background: s.hex }}
              />
              <span className="text-[12.5px] font-medium leading-tight text-[#121821]">{s.name}</span>
              <span className="-mt-1 text-[11px] uppercase tracking-[1px] text-[#5d6874]">{s.hex}</span>
              {s.note && <span className="text-[11.5px] leading-snug text-[#5d6874]">{s.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Seasonal Color Analysis report, laid out like a magazine feature. */
export function ColorReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as ColorExtra;
  const best = x.groups.clothing[0] ?? data.palette[0];
  const [picked, setPicked] = useState<NotedSwatch | null>(best ?? null);
  const comparisons = [
    { title: "Best", swatch: x.groups.clothing[0] },
    { title: "Neutral", swatch: x.groups.neutrals[0] },
    { title: "Less harmony", swatch: x.groups.lessHarmonious[0] },
  ].filter((c): c is { title: string; swatch: NotedSwatch } => Boolean(c.swatch && isHex(c.swatch.hex)));
  const ranked = [...x.seasons].sort((a, b) => b.score - a.score);

  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(18,30,45,0.1)]">
      {/* Cover */}
      <header className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_360px]" style={{ background: module.tint }}>
        <div className="flex flex-col">
          <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
            AI Stylist · {module.label} · {longDay(createdAt)}
          </p>
          <p className="mt-8 font-display text-[22px] italic text-[#4f5b66]">{x.primary.subtype}</p>
          <h2 className="mt-1 font-display text-[46px] font-normal leading-[1] tracking-[-1px] text-[#121821] sm:text-[64px]">{data.headline}</h2>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
            {data.keywords.map((k) => (
              <li key={k} className="text-[11.5px] font-medium uppercase tracking-[2px] text-[#4f5b66]">
                {k}
              </li>
            ))}
          </ul>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-[#2b3540]">{data.summary}</p>
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-4 pt-10 sm:grid-cols-4">
            {(
              [
                ["Undertone", x.characteristics.undertone],
                ["Value", x.characteristics.value],
                ["Chroma", x.characteristics.chroma],
                ["Contrast", x.characteristics.contrast],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className={label}>{k}</dt>
                <dd className="mt-1 text-[14.5px] font-medium text-[#121821]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Drape portrait={portrait} color={picked?.hex ?? module.tones[0]} className="mx-auto aspect-[4/5] w-full max-w-[360px] rounded-t-full" />
      </header>

      {/* The four seasons */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-6`}>Four-season compatibility</p>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ranked.map((s) => {
            const info = SEASON_INFO[s.season];
            const isPrimary = s.season === x.primary.season;
            const isSecondary = s.season === x.secondary?.season;
            return (
              <li key={s.season} className={`rounded-[20px] p-5 ${isPrimary ? "bg-[#121821] text-white" : "bg-[#f6f7f8] text-[#121821]"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-[28px] leading-none">{info.name}</h3>
                  <span className="text-[13px] font-semibold tabular-nums">{s.score}%</span>
                </div>
                <p className={`mt-1 text-[11px] uppercase tracking-[1.6px] ${isPrimary ? "text-white/70" : "text-[#5d6874]"}`}>
                  {isPrimary ? "Your season" : isSecondary ? "Also suits you" : info.feel}
                </p>
                <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${isPrimary ? "bg-white/20" : "bg-[#e3e7eb]"}`}>
                  <div className={`h-full rounded-full ${isPrimary ? "bg-white" : "bg-[#121821]"}`} style={{ width: `${s.score}%` }} />
                </div>
                <div className="mt-4 flex h-8 overflow-hidden rounded-[8px]">
                  {info.palette.map((c) => (
                    <span key={c.hex} className="flex-1" style={{ background: c.hex }} title={c.name} />
                  ))}
                </div>
                {s.note && <p className={`mt-3 text-[12.5px] leading-snug ${isPrimary ? "text-white/80" : "text-[#4f5b66]"}`}>{s.note}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Drape comparison */}
      {comparisons.length > 0 && (
        <section className="px-7 pb-10 sm:px-12" style={{ background: `linear-gradient(180deg, #fff, ${module.tint})` }}>
          <p className={`${label} mb-6`}>Side by side</p>
          <ul className="grid grid-cols-3 gap-3 sm:gap-6">
            {comparisons.map((c) => (
              <li key={c.title}>
                <Drape portrait={portrait} color={c.swatch.hex} className="aspect-[4/5] w-full rounded-[18px]" />
                <p className="mt-3 text-[11px] font-medium uppercase tracking-[2px] text-[#5d6874]">{c.title}</p>
                <p className="text-[13.5px] font-medium text-[#121821]">
                  {c.swatch.name} <span className="font-normal text-[#5d6874]">{c.swatch.hex}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[12px] text-[#5d6874]">Tap any color below to drape it on your portrait at the top.</p>
        </section>
      )}

      {/* Palette */}
      <section className="grid gap-10 px-7 py-10 sm:px-12 lg:grid-cols-2">
        <SwatchList title="Clothing colors" swatches={x.groups.clothing} onPick={setPicked} picked={picked?.hex ?? ""} />
        <div className="flex flex-col gap-10">
          <SwatchList title="Neutrals" swatches={x.groups.neutrals} onPick={setPicked} picked={picked?.hex ?? ""} />
          <SwatchList title="Accents" swatches={x.groups.accents} onPick={setPicked} picked={picked?.hex ?? ""} />
        </div>
        <SwatchList title="May create less harmony" swatches={x.groups.lessHarmonious} onPick={setPicked} picked={picked?.hex ?? ""} />
      </section>

      {/* Assessment */}
      <section className="grid gap-x-12 gap-y-8 px-7 py-10 sm:px-12 md:grid-cols-2" style={{ background: module.tint }}>
        <div>
          <p className={label}>Recommended season</p>
          <p className="mt-2 font-display text-[34px] leading-tight text-[#121821]">{x.primary.subtype}</p>
          {x.secondary && <p className="mt-1 text-[14px] text-[#4f5b66]">Possible second season: {x.secondary.subtype}</p>}
        </div>
        {data.sections.map((s) => (
          <div key={s.title}>
            <h3 className="font-display text-[26px] leading-tight text-[#121821]">{s.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#4f5b66]">{s.body}</p>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-7 py-6 text-[11.5px] text-[#5d6874] sm:px-12">
        <span>
          Confidence: <span className="font-semibold text-[#121821]">{data.confidence}</span>
          {data.limits ? ` · ${data.limits}` : ""}
        </span>
        <span>An informed styling suggestion from one photo, not a scientific or personality assessment.</span>
      </footer>
    </article>
  );
}
