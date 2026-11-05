"use client";

import { useEffect, useRef, useState } from "react";
import { BeforeAfter, Checklist, Chip, Cover, Panel, Why, shortDay } from "@/components/studio/board";
import { drawMakeup, prepareMakeup, type MakeupCanvas } from "@/lib/makeupPreview";
import type { NotedSwatch } from "@/lib/studioColor";
import type { MakeupExtra } from "@/lib/studioMakeup";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";
import { topPicks } from "@/lib/studioPicks";

/** Tap a shade to see it; ∅ takes it off. */
function ShadePicker({ title, shades, picked, onPick }: { title: string; shades: NotedSwatch[]; picked?: string; onPick: (hex: string | undefined) => void }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold text-[#5d6874]">{title}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPick(undefined)}
          aria-label={`No ${title.toLowerCase()}`}
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-white text-[14px] text-[#9aa4ad] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] ${!picked ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
        >
          ∅
        </button>
        {shades.map((s) => (
          <button
            key={s.hex + s.name}
            onClick={() => onPick(s.hex)}
            aria-label={`Try ${s.name}`}
            title={s.name}
            className={`h-9 w-9 rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,0.18)] ${picked === s.hex ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
            style={{ background: s.hex }}
          />
        ))}
      </div>
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
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[14px] bg-[#e9edf1]">
        {/* Before / after once the face is found: drag to compare bare and with the chosen shades. */}
        {portrait && (
          <BeforeAfter
            before={portrait}
            after={<canvas ref={canvas} className="h-full w-full object-cover" aria-label="Your photo with the chosen lip color and blush" />}
            afterLabel="With makeup"
            className={`h-full w-full ${prepared ? "" : "hidden"}`}
          />
        )}
        {!prepared && portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="Your photo" className={`h-full w-full object-cover ${prepared === undefined ? "animate-pulse" : ""}`} />
        )}
      </div>
      {prepared === null ? (
        <p className="text-[12.5px] text-[#5d6874]">Your face wasn&apos;t found clearly in this photo, so the preview is off.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ShadePicker title="Lips" shades={shades.lipstick} picked={lip} onPick={setLip} />
          <ShadePicker title="Blush" shades={shades.blush} picked={blush} onPick={setBlush} />
          <p className="text-[11px] text-[#8a939c]">A light preview on your device.</p>
        </div>
      )}
    </div>
  );
}

/** The Personal Makeup Guide as a board: verdict, try-on of lips and blush, short tips and shade rows. */
export function MakeupReport({ module, data, portrait, createdAt }: { module: StudioModule; data: StudioReportData; portrait: string | null; createdAt: string }) {
  const x = data.extra as MakeupExtra;
  const tips = [
    ["Base", x.recommendations.base],
    ["Brows", x.recommendations.brows],
    ["Eyes", x.recommendations.eyes],
    ["Liner", x.recommendations.eyeliner],
    ["Blush", x.recommendations.blush],
    ["Lips", x.recommendations.lips],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <Cover
        module={module}
        portrait={portrait}
        date={shortDay(createdAt)}
        banner={{ label: "Your makeup style", value: x.styles[0]?.name ?? data.headline, line: x.styles.length > 1 ? `Also works: ${x.styles.slice(1).map((s) => s.name).join(", ")}` : undefined }}
        keywords={data.keywords}
        picks={topPicks("makeup", data).slice(1)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel module={module} title="Try your shades" note="tap a color">
          <MakeupMirror portrait={portrait} shades={x.shades} />
        </Panel>

        <Panel module={module} title="Your shades">
          <div className="flex flex-col gap-4">
            {(
              [
                ["Eyeshadow", x.shades.eyeshadow],
                ["Blush", x.shades.blush],
                ["Lips", x.shades.lipstick],
                ["Brows", x.shades.brow],
              ] as const
            ).map(([title, list]) =>
              list.length ? (
                <div key={title}>
                  <p className="mb-1.5 text-[12px] font-semibold text-[#5d6874]">{title}</p>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
                    {list.map((s) => (
                      <Chip key={s.hex + s.name} swatch={s} />
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </Panel>
      </div>

      <Panel module={module} title="How to do it">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {tips.map(([k, v]) => (
            <li key={k} className="rounded-[14px] bg-[#f6f7f8] p-3">
              <p className="text-[12px] font-semibold" style={{ color: module.accent }}>
                {k}
              </p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-[#4f5b66]" title={v}>
                {v}
              </p>
            </li>
          ))}
        </ul>
        <Why text={Object.values(x.features).join(" ")} label="What we noticed" />
      </Panel>

      <Panel module={module} title="Your makeup plan">
        <Checklist module={module} items={[x.direction]} />
        <p className="mt-4 text-[11px] text-[#8a939c]">
          Confidence: {data.confidence}
          {data.limits ? ` · ${data.limits}` : ""} · Ideas to enjoy, never something you need to change.
        </p>
      </Panel>
    </div>
  );
}
