"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ArrowRightIcon, CameraIcon, CheckIcon, MirrorIcon } from "@/components/Icons";
import { ErrorNote, PageShell, btnPrimary, btnSecondary, btnText, surface } from "@/components/ui";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { portraitUrl, useStudio } from "@/components/studio/useStudio";
import { STUDIO_MODULES, portraitReadiness } from "@/lib/studioModules";


const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * AI Stylist: the person's portrait, and four analyses made from it (color, makeup, hair, style), each generated
 * only when asked and kept to reopen for free. Trying clothes on is one tap away, in Studio.
 */
export default function StylistPage() {
  const { user } = useAuth();
  const { state, failed, reload, savePortrait, removePortrait } = useStudio();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function save(photo: Blob, fromTryOnPhoto = false) {
    setSaving(true);
    setError(null);
    try {
      await savePortrait(photo, fromTryOnPhoto);
    } catch (err) {
      setError(err instanceof Error && err.message !== "photo" ? err.message : "That photo couldn't be used. Try a JPG or PNG.");
    } finally {
      setSaving(false);
    }
  }

  async function useTryOnPhoto() {
    const photo = await fetch(`/api/me/photo?v=${user?.photoVersion}`).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    if (photo) await save(photo, true);
    else setError("Couldn't open your try-on photo. Upload a portrait instead.");
  }

  async function remove() {
    if (!confirm("Remove your portrait? Your finished reports stay.")) return;
    try {
      await removePortrait();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove it. Please try again.");
    }
  }

  const portrait = state?.portrait ?? null;
  const picture = portraitUrl(portrait);
  const readiness = portraitReadiness(portrait?.checks ?? null);

  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-8 sm:pt-12">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) save(file);
          }}
        />

        {/* The portrait, and the studio's title beside it. */}
        <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <h1 className="font-display text-[48px] font-normal leading-[0.98] tracking-[-1.5px] text-[#121821] sm:text-[68px]">AI Stylist</h1>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#4f5b66]">Discover your colors, beauty preferences, and personal style.</p>

            <div className="mt-7 flex flex-col gap-3">
              {state === null && !failed && <p className="text-[13px] text-[#5d6874]">Loading…</p>}
              {failed && (
                <p className="text-[13px] text-[#5d6874]">
                  Studio didn&apos;t load.{" "}
                  <button onClick={reload} className="font-semibold text-[#121821] underline underline-offset-4">
                    Try again
                  </button>
                </p>
              )}
              {state && (
                <>
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#121821]">
                    <span className={`h-2 w-2 rounded-full ${!portrait ? "bg-[#c3cad1]" : readiness.ready ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {!portrait ? "Add a portrait to begin" : readiness.note}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => fileInput.current?.click()} disabled={saving} className={portrait ? btnSecondary : btnPrimary}>
                      <CameraIcon className="h-4 w-4" /> {saving ? "Checking your photo…" : portrait ? "Replace portrait" : "Upload portrait"}
                    </button>
                    {!portrait && user?.photoVersion && (
                      <button onClick={useTryOnPhoto} disabled={saving} className={btnText}>
                        Use my try-on photo
                      </button>
                    )}
                    {portrait && (
                      <button onClick={remove} className={`${btnText} text-[#5d6874]`}>
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="max-w-md text-[12px] leading-relaxed text-[#5d6874]">
                    Best: head and shoulders, facing the camera, in daylight, without filters. It&apos;s checked on your device first and kept private. Your
                    try-on photo isn&apos;t changed.
                  </p>
                  {error && <ErrorNote message={error} />}
                </>
              )}
            </div>
          </div>

          <div className="mx-auto aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-t-full rounded-b-[28px] bg-[#e9edf1] shadow-[0_24px_60px_rgba(18,30,45,0.14)] md:max-w-none">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picture} alt="Your portrait" className="h-full w-full object-cover" />
            ) : (
              <button onClick={() => fileInput.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-[13px] text-[#4f5b66]">
                <CameraIcon className="h-6 w-6" />
                Your portrait
              </button>
            )}
          </div>
        </section>

        {/* The four analyses. */}
        <section className="mt-14" aria-label="Analyses">
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
                      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[#4f5b66]">{m.description}</p>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#121821]">
                        {done ? "View report" : "Analyze"} <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Trying clothes on: the mirror, one tap away. */}
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
