"use client";

import { useEffect, useRef, useState } from "react";
import { drawMakeup, prepareMakeup, type MakeupCanvas } from "@/lib/makeupPreview";
import type { NotedSwatch } from "@/lib/studioColor";
import type { MakeupExtra } from "@/lib/studioMakeup";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";

const label = "text-[11px] font-medium uppercase tracking-[2.6px] text-[#5d6874]";
const longDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function ShadeRow({ title, shades, picked, onPick }: { title: string; shades: NotedSwatch[]; picked?: string; onPick?: (hex: string | undefined) => void }) {
  if (!shades.length) return null;
  return (
    <div>
      <p className={`${label} mb-3`}>{title}</p>
      <ul className="flex flex-wrap gap-4">
        {onPick && (
          <li>
            <button onClick={() => onPick(undefined)} className="flex w-[68px] flex-col items-center gap-1.5 text-center" aria-label={`No ${title.toLowerCase()}`}>
              <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-white text-[18px] text-[#9aa4ad] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] ${!picked ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}>∅</span>
              <span className="text-[11.5px] text-[#5d6874]">None</span>
            </button>
          </li>
        )}
        {shades.map((s) => {
          const inner = (
            <>
              <span
                className={`h-12 w-12 rounded-full shadow-[inset_0_-4px_8px_rgba(0,0,0,0.18),0_2px_6px_rgba(18,24,33,0.12)] ${picked === s.hex ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
                style={{ background: s.hex }}
              />
              <span className="text-[11.5px] font-medium leading-tight text-[#121821]">{s.name}</span>
              <span className="-mt-1 text-[10.5px] uppercase tracking-[1px] text-[#5d6874]">{s.hex}</span>
            </>
          );
          return (
            <li key={s.hex + s.name}>
              {onPick ? (
                <button onClick={() => onPick(s.hex)} className="flex w-[68px] flex-col items-center gap-1.5 text-center" aria-label={`Try ${s.name}`}>
                  {inner}
                </button>
              ) : (
                <div className="flex w-[68px] flex-col items-center gap-1.5 text-center">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The portrait with a lip color and blush laid over it, on this device. */
function MakeupMirror({ portrait, shades }: { portrait: string | null; shades: MakeupExtra["shades"] }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [prepared, setPrepared] = useState<MakeupCanvas | null | undefined>(undefined);
  const [lip, setLip] = useState<string | undefined>(shades.lipstick[0]?.hex);
  const [blush, setBlush] = useState<string | undefined>(shades.blush[0]?.hex);

  useEffect(() => {
    if (!portrait) return;
    let live = true;
    prepareMakeup(portrait)
      .then((p) => live && setPrepared(p))
      .catch(() => live && setPrepared(null));
    return () => {
      live = false;
    };
  }, [portrait]);

  useEffect(() => {
    if (prepared && canvas.current) drawMakeup(canvas.current, prepared, { lip, blush });
  }, [prepared, lip, blush]);

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-[22px] bg-[#e9edf1]">
        <canvas ref={canvas} className={`h-full w-full object-cover ${prepared ? "" : "hidden"}`} aria-label="Your portrait with the chosen lip color and blush" />
        {!prepared && portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="Your portrait" className={`h-full w-full object-cover ${prepared === undefined ? "animate-pulse" : ""}`} />
        )}
      </div>
      <div className="flex flex-col gap-7">
        {prepared === null && <p className="text-[12.5px] text-[#5d6874]">Your face couldn&apos;t be found clearly in this portrait, so the preview is off. The shades are below.</p>}
        <ShadeRow title="Lips" shades={shades.lipstick} picked={lip} onPick={prepared ? setLip : undefined} />
        <ShadeRow title="Blush" shades={shades.blush} picked={blush} onPick={prepared ? setBlush : undefined} />
        {prepared && <p className="text-[11.5px] text-[#5d6874]">A light preview made on your device; real shades vary with formula and light.</p>}
      </div>
    </div>
  );
}

/** The Personal Makeup Guide report, laid out like a beauty magazine page. */
export function MakeupReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as MakeupExtra;
  const features = [
    ["Eyes", x.features.eyes],
    ["Brows", x.features.brows],
    ["Lips", x.features.lips],
    ["Proportions", x.features.proportions],
    ["Undertone", x.features.undertone],
  ] as const;
  const recommendations = [
    ["Brows", x.recommendations.brows],
    ["Eyes", x.recommendations.eyes],
    ["Eyeliner", x.recommendations.eyeliner],
    ["Blush", x.recommendations.blush],
    ["Lips", x.recommendations.lips],
    ["Base and finish", x.recommendations.base],
  ] as const;

  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(18,30,45,0.1)]">
      <header className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ background: module.tint }}>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
            Virm Studio · {module.label} · {longDay(createdAt)}
          </p>
          {x.styles[0] && <p className="mt-8 font-display text-[22px] italic text-[#4f5b66]">{x.styles[0].name}</p>}
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
        <div className="mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-full bg-white/60">
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="Your portrait" className="h-full w-full object-cover" />
          )}
        </div>
      </header>

      {/* Features */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-6`}>Your features</p>
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
          {features.map(([k, v]) => (
            <div key={k}>
              <dt className="font-display text-[22px] leading-none text-[#121821]">{k}</dt>
              <dd className="mt-2 text-[13.5px] leading-relaxed text-[#4f5b66]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Try the shades */}
      <section className="px-7 py-10 sm:px-12" style={{ background: `linear-gradient(180deg, #fff, ${module.tint})` }}>
        <p className={`${label} mb-6`}>Try your shades</p>
        <MakeupMirror portrait={portrait} shades={x.shades} />
      </section>

      {/* Recommendations */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-6`}>How to wear it</p>
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map(([k, v]) => (
            <div key={k}>
              <h3 className="font-display text-[24px] leading-tight text-[#121821]">{k}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4f5b66]">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Styles */}
      <section className="px-7 pb-10 sm:px-12">
        <p className={`${label} mb-6`}>Makeup styles for you</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {x.styles.map((s) => (
            <li key={s.name} className={`rounded-[20px] p-5 ${s.best ? "bg-[#121821] text-white" : "bg-[#f6f7f8] text-[#121821]"}`}>
              <p className={`text-[10.5px] uppercase tracking-[1.8px] ${s.best ? "text-white/60" : "text-[#5d6874]"}`}>{s.best ? "Best match" : "Also works"}</p>
              <h3 className="mt-2 font-display text-[26px] leading-none">{s.name}</h3>
              <p className={`mt-3 text-[12.5px] leading-snug ${s.best ? "text-white/80" : "text-[#4f5b66]"}`}>{s.why}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Shades */}
      <section className="grid gap-8 px-7 py-10 sm:px-12 md:grid-cols-2" style={{ background: module.tint }}>
        <ShadeRow title="Eyeshadow" shades={x.shades.eyeshadow} />
        <ShadeRow title="Brows" shades={x.shades.brow} />
        <ShadeRow title="Blush" shades={x.shades.blush} />
        <ShadeRow title="Lipstick" shades={x.shades.lipstick} />
      </section>

      <section className="px-7 py-10 sm:px-12">
        <h3 className="font-display text-[30px] leading-tight text-[#121821]">Your makeup direction</h3>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#4f5b66]">{x.direction}</p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-7 pb-6 text-[11.5px] text-[#5d6874] sm:px-12">
        <span>
          Confidence: <span className="font-semibold text-[#121821]">{data.confidence}</span>
          {data.limits ? ` · ${data.limits}` : ""}
        </span>
        <span>Suggestions to enjoy, never something you need to change.</span>
      </footer>
    </article>
  );
}
