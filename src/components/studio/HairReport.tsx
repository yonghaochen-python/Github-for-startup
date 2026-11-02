"use client";

import { useEffect, useState } from "react";
import { recolorHair, type Recolored } from "@/lib/recolor";
import { HAIR_DIMENSIONS, type HairExtra, type HairRating } from "@/lib/studioHair";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";

const label = "text-[11px] font-medium uppercase tracking-[2.6px] text-[#5d6874]";
const longDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

const RATING: Record<HairRating, { title: string; chip: string }> = {
  recommended: { title: "Recommended", chip: "bg-[#121821] text-white" },
  alternative: { title: "Alternative", chip: "bg-[#e9edf1] text-[#2b3540]" },
  less: { title: "Less preferred", chip: "bg-transparent text-[#8a5a4a] shadow-[inset_0_0_0_1px_rgba(138,90,74,0.4)]" },
};

/** The portrait in each hair color, made on this device (only the hair changes). */
function HairColors({ portrait, colors }: { portrait: string | null; colors: HairExtra["colors"] }) {
  const [pictures, setPictures] = useState<Recolored[] | null | undefined>(undefined);
  const key = colors.map((c) => c.hex).join();

  useEffect(() => {
    if (!portrait || !key) return;
    let made: Recolored[] = [];
    let live = true;
    recolorHair(portrait, key.split(","))
      .then((result) => {
        made = result ?? [];
        if (live) setPictures(result);
      })
      .catch(() => live && setPictures(null));
    return () => {
      live = false;
      made.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, [portrait, key]);

  return (
    <>
      {pictures === null && <p className="mb-4 text-[12.5px] text-[#5d6874]">Your hair couldn&apos;t be found clearly in this portrait, so the colors are shown as swatches.</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((c, i) => {
          const pic = pictures?.[i];
          return (
            <li key={c.hex + c.name}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[16px]" style={{ background: `linear-gradient(160deg, ${c.hex}, ${c.hex}bb)` }}>
                {pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pic.url} alt={`You with ${c.name} hair`} className="h-full w-full object-cover" />
                ) : (
                  pictures === undefined && portrait && <div className="absolute inset-0 animate-pulse bg-white/30" />
                )}
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${RATING[c.rating].chip} ${c.rating === "less" ? "bg-white/85" : ""}`}>{RATING[c.rating].title}</span>
              </div>
              <p className="mt-2.5 text-[10.5px] font-medium uppercase tracking-[1.6px] text-[#5d6874]">{c.family}</p>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#121821]">
                <span className="h-3 w-3 rounded-full" style={{ background: c.hex }} />
                {c.name} <span className="font-normal text-[#5d6874]">{c.hex}</span>
              </p>
              {c.note && <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">{c.note}</p>}
            </li>
          );
        })}
      </ul>
      {pictures && <p className="mt-4 text-[11.5px] text-[#5d6874]">Made on your device by tinting only your hair; real results depend on your starting color and the salon.</p>}
    </>
  );
}

/** The Hair & Color Guide report, laid out like a salon lookbook. */
export function HairReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as HairExtra;
  const best = x.colors.find((c) => c.rating === "recommended") ?? x.colors[0];

  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(18,30,45,0.1)]">
      <header className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ background: module.tint }}>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
            AI Stylist · {module.label} · {longDay(createdAt)}
          </p>
          <p className="mt-8 font-display text-[22px] italic text-[#4f5b66]">{x.final.style}</p>
          <h2 className="mt-1 font-display text-[46px] font-normal leading-[1] tracking-[-1px] text-[#121821] sm:text-[64px]">{data.headline}</h2>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
            {data.keywords.map((k) => (
              <li key={k} className="text-[11.5px] font-medium uppercase tracking-[2px] text-[#4f5b66]">
                {k}
              </li>
            ))}
          </ul>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-[#2b3540]">{data.summary}</p>
        </div>
        <div className="mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-t-[28px] bg-white/60">
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="Your portrait" className="h-full w-full object-cover" />
          )}
        </div>
      </header>

      {/* Hair colors on you */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-6`}>Hair colors on you</p>
        <HairColors portrait={portrait} colors={x.colors} />
      </section>

      {/* Hairstyle comparison */}
      <section className="px-7 py-10 sm:px-12" style={{ background: `linear-gradient(180deg, #fff, ${module.tint})` }}>
        <p className={`${label} mb-6`}>Hairstyles compared</p>
        <div className="flex flex-col gap-8">
          {HAIR_DIMENSIONS.map((d) => {
            const options = x.styles.filter((s) => s.dimension === d.id);
            if (!options.length) return null;
            return (
              <div key={d.id} className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                <h3 className="font-display text-[26px] leading-none text-[#121821]">{d.title}</h3>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {options.map((o) => (
                    <li key={o.option} className={`rounded-[18px] p-4 ${o.rating === "recommended" ? "bg-white shadow-[0_8px_22px_rgba(18,30,45,0.08)]" : "bg-white/60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-semibold text-[#121821]">{o.option}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${RATING[o.rating].chip}`}>{RATING[o.rating].title}</span>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-snug text-[#4f5b66]">{o.effect}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* At a glance */}
      <section className="grid gap-8 px-7 py-10 sm:px-12 md:grid-cols-3">
        {(["recommended", "alternative", "less"] as const).map((r) => (
          <div key={r}>
            <p className="font-display text-[24px] leading-none text-[#121821]">{r === "alternative" ? "Alternatives" : RATING[r].title}</p>
            <ul className="mt-4 space-y-1.5 text-[13.5px] text-[#4f5b66]">
              {x.styles
                .filter((s) => s.rating === r)
                .map((s) => (
                  <li key={s.dimension + s.option}>{s.option}</li>
                ))}
              {x.colors
                .filter((c) => c.rating === r)
                .map((c) => (
                  <li key={c.hex + c.name} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.hex }} /> {c.name}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Final recommendation */}
      <section className="grid items-center gap-8 px-7 py-10 sm:px-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" style={{ background: module.tint }}>
        <div>
          <p className={label}>Your best direction</p>
          <p className="mt-3 font-display text-[32px] leading-tight text-[#121821]">{x.final.style}</p>
          <p className="mt-2 flex items-center gap-2 text-[15px] text-[#2b3540]">
            {best && <span className="h-4 w-4 rounded-full" style={{ background: best.hex }} />}
            {x.final.color}
          </p>
        </div>
        <div>
          <p className="text-[15px] leading-relaxed text-[#4f5b66]">{x.final.why}</p>
          <p className="mt-4 text-[11.5px] text-[#5d6874]">Pictures of you with a different haircut aren&apos;t included yet; the colors above are shown on your own hair.</p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-7 py-6 text-[11.5px] text-[#5d6874] sm:px-12">
        <span>
          Confidence: <span className="font-semibold text-[#121821]">{data.confidence}</span>
          {data.limits ? ` · ${data.limits}` : ""}
        </span>
        <span>Ideas to enjoy, never something you need to change.</span>
      </footer>
    </article>
  );
}
