"use client";

import Link from "next/link";
import { ArrowRightIcon, CameraIcon, CheckIcon, MirrorIcon } from "@/components/Icons";
import { PageShell, btnPrimary, surface } from "@/components/ui";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { PortraitControls } from "@/components/studio/PortraitPanel";
import { PickSwatches } from "@/components/studio/TopPicks";
import { portraitUrl, useStudio } from "@/components/studio/useStudio";
import { STUDIO_MODULES, portraitReadiness } from "@/lib/studioModules";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The three steps, with the one the person is on lit up. */
function Guide({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Add a clear photo of you", "Pick an analysis and press Analyze", "Read your top picks first"];
  return (
    <ol className="flex max-w-md flex-col gap-2" aria-label="How it works">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < step;
        const now = n === step;
        return (
          <li key={s} className={`flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 ${now ? "bg-white shadow-[0_8px_22px_rgba(18,30,45,0.08)]" : ""}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${done ? "bg-emerald-500 text-white" : now ? "bg-[#121821] text-white" : "bg-[#e3e7eb] text-[#5d6874]"}`}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={`text-[13px] ${now ? "font-semibold text-[#121821]" : "text-[#4f5b66]"}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * AI Stylist: the person's photo, and four analyses made from it (color, makeup, hair, style), each generated only
 * when asked and kept to reopen for free. A guide shows the next step; finished cards show their main picks.
 */
export default function StylistPage() {
  const { state, failed, reload, savePortrait, removePortrait } = useStudio();
  const portrait = state?.portrait ?? null;
  const picture = portraitUrl(portrait);
  const readiness = portraitReadiness(portrait?.checks ?? null);
  const anyDone = Object.keys(state?.reports ?? {}).length > 0;
  const step = !portrait || !readiness.ready ? 1 : anyDone ? 3 : 2;
  const next = state ? STUDIO_MODULES.find((m) => !state.reports[m.id]) : undefined;

  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-8 sm:pt-12">
        <h1 className="mb-6 font-display text-[44px] font-normal leading-[1] tracking-[-1.4px] text-[#121821] sm:text-[60px]">AI Stylist</h1>

        {/* The photo on the left; everything about it (its warning, changing it) and the steps right beside it. */}
        <section className="grid items-center gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="mx-auto aspect-[4/5] w-full max-w-[240px] overflow-hidden rounded-b-[24px] rounded-t-full bg-[#e9edf1] shadow-[0_18px_44px_rgba(18,30,45,0.12)]">
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
          <div className="flex min-w-0 flex-col gap-6">
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
              <>
                <PortraitControls portrait={portrait} savePortrait={savePortrait} removePortrait={removePortrait} />
                <Guide step={step} />
                {/* The next analysis to do, one tap away (Seasonal Color first: the others build on its colors). */}
                {next && readiness.ready && portrait && (
                  <Link href={`/stylist/${next.id}`} className={`${btnPrimary} self-start`}>
                    {anyDone ? `Next: ${next.title}` : `Start with ${next.title}`} <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                )}
              </>
            )}
          </div>
        </section>

        {/* The four analyses. */}
        <section className="mt-12" aria-label="Analyses">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-[32px] leading-none text-[#121821] sm:text-[38px]">Your analyses</h2>
            <p className="hidden text-[12.5px] text-[#5d6874] sm:block">Each one is made only when you ask, and saved for you.</p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {STUDIO_MODULES.map((m, i) => {
              const done = state?.reports[m.id];
              return (
                <li key={m.id}>
                  <Link href={`/stylist/${m.id}`} className={`${surface} group flex h-full flex-col overflow-hidden transition-transform hover:-translate-y-0.5`}>
                    <ModuleVisual module={m} portrait={picture} className="aspect-[16/10] w-full" />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium uppercase tracking-[2.2px]" style={{ color: m.accent }}>
                          {String(i + 1).padStart(2, "0")} · {m.label}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${done ? "bg-[#121821] text-white" : "bg-[#eef1f4] text-[#5d6874]"}`}
                        >
                          {done ? (
                            <>
                              <CheckIcon className="h-3 w-3" /> Completed · {day(done.createdAt)}
                            </>
                          ) : (
                            "Not started"
                          )}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-[28px] leading-tight text-[#121821]">{m.title}</h3>
                      {done?.picks?.length ? (
                        // The report's main picks, so this page reads as a summary.
                        <dl className="mt-3 flex flex-1 flex-col gap-3">
                          {done.picks.map((p) => (
                            <div key={p.label}>
                              <dt className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[#5d6874]">{p.label}</dt>
                              {p.value && <dd className="mt-0.5 text-[15px] font-medium text-[#121821]">{p.value}</dd>}
                              {p.swatches?.length ? (
                                <dd className="mt-1.5">
                                  <PickSwatches pick={p} size="sm" />
                                </dd>
                              ) : null}
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[#4f5b66]">{m.description}</p>
                      )}
                      <span
                        className={`mt-5 inline-flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-[13px] font-semibold ${
                          done ? "bg-[#eef1f4] text-[#121821]" : "bg-[#121821] text-white"
                        }`}
                      >
                        {done ? "See report" : "Start"} <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
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
