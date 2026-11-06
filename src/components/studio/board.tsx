"use client";

import { useEffect, useState } from "react";
import { recolorHair, recolorTop, type Recolored } from "@/lib/recolor";
import type { Pick } from "@/lib/studioPicks";
import type { StudioModule, Swatch } from "@/lib/studioModules";

/**
 * The building blocks of an AI Stylist report "board": mostly pictures, very short labels, ✓ / ○ / ✗ rows and stars,
 * with the longer explanations folded behind "Why?". Every report uses them, so the four read as one set.
 */

export type Verdict = "yes" | "ok" | "no";

const VERDICT: Record<Verdict, { mark: string; title: string; ring: string }> = {
  yes: { mark: "✓", title: "Best", ring: "bg-emerald-500 text-white" },
  ok: { mark: "○", title: "Okay", ring: "bg-white text-amber-500 shadow-[inset_0_0_0_2px_#f59e0b]" },
  no: { mark: "✕", title: "Avoid", ring: "bg-rose-500 text-white" },
};

/** One part of the board: a small serif title in the module's color. */
export function Panel({ module, title, note, children, className = "" }: { module: StudioModule; title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] bg-white p-5 shadow-[0_10px_30px_rgba(18,30,45,0.06)] sm:p-6 ${className}`}>
      <h3 className="mb-4 flex items-baseline gap-2 font-display text-[24px] leading-none" style={{ color: module.accent }}>
        {title}
        {note && <span className="font-sans text-[11px] font-medium tracking-[0.5px] text-[#5d6874]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** A row of pictures or swatches with its ✓ / ○ / ✗ mark on the left. */
export function VerdictRow({ verdict, children }: { verdict: Verdict; children: React.ReactNode }) {
  const v = VERDICT[verdict];
  return (
    <div className="flex items-start gap-3">
      <div className="flex w-10 shrink-0 flex-col items-center gap-1 pt-6">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${v.ring}`} aria-hidden>
          {v.mark}
        </span>
        <span className="text-[10px] font-semibold text-[#5d6874]">{v.title}</span>
      </div>
      <ul className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(82px,1fr))]">{children}</ul>
    </div>
  );
}

/** A small picture (or a color, when there's no picture) with a two-word label. */
export function Thumb({ image, color, label, sub, round = false }: { image?: string | null; color?: string; label: string; sub?: string; round?: boolean }) {
  return (
    <li className="min-w-0">
      <div className={`relative aspect-[4/5] overflow-hidden ${round ? "rounded-full" : "rounded-[12px]"}`} style={{ background: color ?? "#e9edf1" }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <p className="mt-1 truncate text-center text-[11px] font-medium text-[#2b3540]" title={label}>
        {label}
      </p>
      {sub && <p className="truncate text-center text-[10px] text-[#5d6874]">{sub}</p>}
    </li>
  );
}

/** A plain color chip with its name, for shade rows. */
export function Chip({ swatch }: { swatch: Swatch }) {
  return (
    <li className="min-w-0">
      <div className="h-9 rounded-[8px] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]" style={{ background: swatch.hex }} />
      <p className="mt-1 truncate text-center text-[10.5px] text-[#4f5b66]" title={`${swatch.name} ${swatch.hex}`}>
        {swatch.name}
      </p>
    </li>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="text-[12px] tracking-[1px] text-amber-500" aria-label={`${n} of 5`}>
      {"★".repeat(n)}
      <span className="text-[#d9dde1]">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** A short checklist (keywords, tips). */
export function Checklist({ items, module }: { items: string[]; module: StudioModule }) {
  return (
    <ul className="space-y-1.5">
      {items.filter(Boolean).map((t) => (
        <li key={t} className="flex items-start gap-2 text-[13px] text-[#2b3540]">
          <span className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] text-[9px] text-white" style={{ background: module.accent }} aria-hidden>
            ✓
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

/** The longer explanation, folded away until asked for. */
export function Why({ text, label = "Why?" }: { text: string; label?: string }) {
  if (!text) return null;
  return (
    <details className="group mt-3 text-[12.5px] text-[#4f5b66]">
      <summary className="cursor-pointer list-none font-semibold text-[#121821] [&::-webkit-details-marker]:hidden">
        <span className="underline underline-offset-4">{label}</span> <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <p className="mt-2 leading-relaxed">{text}</p>
    </details>
  );
}

/** The one-line verdict, in a dark banner. */
export function Banner({ module, label, value, line }: { module: StudioModule; label: string; value: string; line?: string }) {
  return (
    <div className="rounded-[16px] px-5 py-4 text-white" style={{ background: module.accent }}>
      <p className="text-[15px]">
        <span className="opacity-80">{label}: </span>
        <span className="font-display text-[24px] leading-none">{value}</span>
      </p>
      {line && <p className="mt-1 text-[12.5px] opacity-85">{line}</p>}
    </div>
  );
}

/**
 * Before and after on the same photo: drag (or use the arrow keys on) the line to compare. The "after" is made on
 * the device (a recolor or makeup preview), so comparing never calls the AI.
 */
export function BeforeAfter({ before, after, afterLabel, className = "" }: { before: string; after: React.ReactNode; afterLabel: string; className?: string }) {
  const [at, setAt] = useState(50);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Your photo, before" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${at}%)` }}>
        {after}
      </div>
      <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)]" style={{ left: `${at}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[12px] text-[#121821] shadow">⇆</span>
      </span>
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white">Before</span>
      <span className="pointer-events-none absolute bottom-2 right-2 max-w-[60%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={at}
        onChange={(e) => setAt(Number(e.target.value))}
        aria-label={`Compare before and ${afterLabel}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

/** The cover: the portrait (or a before / after of it) beside the verdict banner, the keywords and the top picks. */
export function Cover({
  module,
  portrait,
  date,
  banner,
  keywords,
  picks,
  after,
}: {
  module: StudioModule;
  portrait: string | null;
  date: string;
  banner: { label: string; value: string; line?: string };
  keywords: string[];
  picks: Pick[];
  /** The photo with the main recommendation on it, for a before / after (shown once it's made). */
  after?: { src: string | null; label: string };
}) {
  return (
    <section className="grid gap-5 rounded-[22px] p-5 sm:p-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]" style={{ background: module.tint }}>
      {portrait && after?.src ? (
        <BeforeAfter
          before={portrait}
          // eslint-disable-next-line @next/next/no-img-element
          after={<img src={after.src} alt={`Your photo, ${after.label}`} className="h-full w-full object-cover" />}
          afterLabel={after.label}
          className="aspect-[4/5] w-full rounded-[16px] bg-white/60"
        />
      ) : (
        <div className="aspect-[4/5] w-full overflow-hidden rounded-[16px] bg-white/60">
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="Your photo" className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[2.4px]" style={{ color: module.accent }}>
          AI Stylist · {module.label} · {date}
        </p>
        <Banner module={module} {...banner} />
        <ul className="flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <li key={k} className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#2b3540]">
              {k}
            </li>
          ))}
        </ul>
        <dl className="grid gap-3 sm:grid-cols-2">
          {picks.map((p) => (
            <div key={p.label} className="rounded-[14px] bg-white/80 px-3.5 py-3">
              <dt className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] ${p.skip ? "text-rose-600" : "text-[#5d6874]"}`}>
                <span aria-hidden>{p.skip ? "✕" : "✓"}</span> {p.label}
              </dt>
              {p.value && <dd className="mt-1 text-[14px] font-medium leading-snug text-[#121821]">{p.value}</dd>}
              {p.swatches?.length ? (
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {p.swatches.map((s) => (
                    <span key={s.hex + s.name} className="h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]" style={{ background: s.hex }} title={s.name} />
                  ))}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** The portrait recolored (top or hair) once per color, made on the device. Undefined while working, null if not found. */
export function useRecolored(portrait: string | null, colors: string[], part: "top" | "hair") {
  const [pictures, setPictures] = useState<Recolored[] | null | undefined>(undefined);
  const key = colors.join();
  useEffect(() => {
    if (!portrait || !key) return;
    let made: Recolored[] = [];
    let live = true;
    (part === "hair" ? recolorHair : recolorTop)(portrait, key.split(","))
      .then((result) => {
        made = result ?? [];
        if (live) setPictures(result);
      })
      .catch(() => live && setPictures(null));
    return () => {
      live = false;
      made.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, [portrait, key, part]);
  /** The picture for one color, if it was made. */
  return { pictures, of: (hex: string) => pictures?.find((p) => p.hex === hex)?.url ?? null };
}

export const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
