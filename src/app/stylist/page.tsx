"use client";

import Link from "next/link";
import { ArrowRightIcon, CameraIcon, CheckIcon, MirrorIcon } from "@/components/Icons";
import { PageShell, eyebrow, surface } from "@/components/ui";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { PortraitControls } from "@/components/studio/PortraitPanel";
import { PickSwatches } from "@/components/studio/TopPicks";
import { StyleProfileBoard } from "@/components/studio/StyleProfile";
import { portraitUrl, useStudio } from "@/components/studio/useStudio";
import { STUDIO_MODULES, type StudioModuleId } from "@/lib/studioModules";
import { Tips, type Tip } from "@/components/Tips";

const STYLIST_TIPS: Tip[] = [
  { target: '[data-tip="stylist-photo"]', text: "Use a clear photo of your face and shoulders. Change it here." },
  { target: 'section[aria-label="Analyses"] li', text: "Pick an analysis. Each one uses 1 photo credit." },
  { target: '.site-nav a[href="/outfits/saved"], .site-tabbar a[href="/outfits/saved"]', text: "Your reports are saved in Saved Looks." },
];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** One line each, for the cards (the full descriptions are on each analysis). */
const SHORT: Record<StudioModuleId, string> = {
  color: "Your season, and the palette that lights you up.",
  makeup: "Shades and finishes for brows, eyes, cheeks and lips.",
  hair: "Cuts, lengths and hair colors that frame your face.",
  style: "Your style direction, jewelry, and a look from your closet.",
};

type Status = "none" | "making" | "done" | "earlier";

const STATUS: Record<Status, { chip: string; action: string }> = {
  none: { chip: "Not started", action: "Analyze" },
  making: { chip: "Analyzing…", action: "Analyzing" },
  done: { chip: "Completed", action: "View report" },
  earlier: { chip: "From earlier photo", action: "View report" },
};

/**
 * AI Stylist: a personal beauty and fashion consultation. The person's photo, and four analyses made from it
 * (color, makeup, hair, style), each made only when they press Analyze and kept to reopen for free.
 */
export default function StylistPage() {
  const { state, failed, reload, savePortrait, removePortrait } = useStudio();
  const portrait = state?.portrait ?? null;
  const picture = portraitUrl(portrait);
  const statusOf = (id: StudioModuleId): Status => {
    if (state?.generating?.includes(id)) return "making";
    const r = state?.reports[id];
    if (!r) return "none";
    return portrait && r.portraitVersion && r.portraitVersion !== portrait.version ? "earlier" : "done";
  };
  const decoded = STUDIO_MODULES.filter((m) => statusOf(m.id) === "done").length;

  return (
    <main className="flex-1 pb-20">
      <Tips id="stylist" tips={STYLIST_TIPS} delay={1200} />
      <PageShell className="pt-8 sm:pt-12">
        {/* The consultation: the promise on one side, the person's photo on the other. */}
        <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
          <div className="max-w-xl">
            <p className={`${eyebrow} mb-4`}>AI Stylist · Personal consultation</p>
            <h1 className="font-display text-[52px] font-normal leading-[0.95] tracking-[-1.6px] text-[#121821] sm:text-[76px]">
              Your Style,
              <br />
              <span className="italic text-[#c98a6b]">Decoded.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-[#4f5b66]">
              Discover the colors, beauty looks, hairstyles, and fashion choices that complement your personal style.
            </p>
            {/* How far along they are, as four small marks. */}
            {state && (
              <div className="mt-6 flex items-center gap-3" aria-label={`${decoded} of 4 analyses done`}>
                <div className="flex gap-1.5">
                  {STUDIO_MODULES.map((m) => (
                    <span key={m.id} className="h-1.5 w-8 rounded-full" style={{ background: statusOf(m.id) === "done" ? m.accent : "rgba(93,104,116,0.3)" }} />
                  ))}
                </div>
                <span className="text-[12px] font-medium tracking-wide text-[#5d6874]">{decoded} of 4</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-b-[24px] rounded-t-full bg-[#e9edf1] shadow-[0_18px_44px_rgba(18,30,45,0.14)] md:max-w-none">
              {picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picture} alt="Your photo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[13px] text-[#4f5b66]">
                  <CameraIcon className="h-6 w-6" />
                  Your photo
                </div>
              )}
            </div>
            {state === null && !failed && <p className="text-[13px] text-[#5d6874]">Loading…</p>}
            {failed && (
              <p className="text-[13px] text-[#5d6874]">
                This page didn&apos;t load.{" "}
                <button onClick={reload} className="font-semibold text-[#121821] underline underline-offset-4">
                  Try again
                </button>
              </p>
            )}
            {state && (
              <div data-tip="stylist-photo" className="w-full">
                <PortraitControls portrait={portrait} savePortrait={savePortrait} removePortrait={removePortrait} />
              </div>
            )}
          </div>
        </section>

        {/* Everything so far in one place, once there's at least one report. */}
        {state?.profile && state.profile.sources.length > 0 && <StyleProfileBoard profile={state.profile} portrait={portrait} />}

        {/* The four analyses. */}
        <section className="mt-14" aria-label="Analyses">
          <ul className="grid gap-5 sm:grid-cols-2">
            {STUDIO_MODULES.map((m, i) => {
              const status = statusOf(m.id);
              const report = state?.reports[m.id];
              const { chip, action } = STATUS[status];
              return (
                <li key={m.id}>
                  <Link href={`/stylist/${m.id}`} className={`${surface} group flex h-full flex-col overflow-hidden transition-transform hover:-translate-y-0.5`}>
                    <div className="relative">
                      <ModuleVisual module={m} portrait={picture} className="aspect-[16/10] w-full" />
                      {/* The status on the picture: a check when it's done. */}
                      <span
                        className={`absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
                          status === "done"
                            ? "bg-[#121821] text-white"
                            : status === "making"
                              ? "animate-pulse bg-white/90 text-[#121821]"
                              : status === "earlier"
                                ? "bg-amber-50/95 text-amber-800"
                                : "bg-white/85 text-[#5d6874]"
                        }`}
                      >
                        {status === "done" && <CheckIcon className="h-3 w-3" />}
                        {chip}
                        {status === "done" && report && <span className="font-normal text-white/70">· {day(report.createdAt)}</span>}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-[11px] font-medium uppercase tracking-[2.2px]" style={{ color: m.accent }}>
                        {String(i + 1).padStart(2, "0")} · {m.label}
                      </p>
                      <h2 className="mt-2 font-display text-[28px] leading-tight text-[#121821]">{m.title}</h2>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[#4f5b66]">{SHORT[m.id]}</p>
                      {/* A finished report's first picks, at a glance. */}
                      {status === "done" && report?.picks?.length ? (
                        <div className="mt-4 flex flex-col gap-2">
                          {report.picks.map((p) =>
                            p.swatches?.length ? (
                              <PickSwatches key={p.label} pick={p} size="sm" />
                            ) : p.value ? (
                              <p key={p.label} className="text-[13.5px] font-medium text-[#121821]">
                                {p.value}
                              </p>
                            ) : null
                          )}
                        </div>
                      ) : null}
                      <div className="mt-auto pt-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold ${
                            status === "none" ? "bg-[#121821] text-white" : "bg-[#eef1f4] text-[#121821]"
                          }`}
                        >
                          {action}
                          {status !== "making" && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Trying clothes on: Studio, one tap away. */}
        <Link href="/studio" className={`${surface} group mt-5 flex items-center gap-5 p-6 transition-transform hover:-translate-y-0.5`}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#121821] text-white">
            <MirrorIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[26px] leading-tight text-[#121821]">Try on in Studio</span>
            <span className="block text-[14px] text-[#4f5b66]">Your closet and shopping pieces on your photo, or live.</span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-[#121821] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </PageShell>
    </main>
  );
}
