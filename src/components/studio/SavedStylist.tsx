"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PaletteIcon } from "@/components/Icons";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { PickSwatches } from "@/components/studio/TopPicks";
import { portraitUrl } from "@/components/studio/useStudio";
import { STUDIO_MODULES, type PortraitInfo, type ReportSummary, type StudioModuleId } from "@/lib/studioModules";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Studio = { portrait: PortraitInfo | null; reports: Partial<Record<StudioModuleId, ReportSummary>> };

/** The person's photo and newest report of each kind (undefined while loading, null if it didn't load). */
function useSavedStudio(): Studio | null | undefined {
  const [studio, setStudio] = useState<Studio | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/studio")
      .then(async (res) => (res.ok ? ((await res.json()) as Studio) : null))
      .then(setStudio)
      .catch(() => setStudio(null));
  }, []);
  return studio;
}

/**
 * Home's Saved Looks: the finished AI Stylist reports as small tiles (their styled photo, name and first colors),
 * each opening its report. Nothing shows until there's at least one.
 */
export function SavedStylistStrip() {
  const studio = useSavedStudio();
  const reports = studio?.reports ?? {};
  const done = STUDIO_MODULES.filter((m) => reports[m.id]);
  if (!done.length) return null;
  const picture = portraitUrl(studio?.portrait ?? null);
  return (
    <div className="px-6 pt-5 sm:px-8">
      <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">
        <PaletteIcon className="h-3.5 w-3.5" /> AI Stylist
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {done.map((m) => {
          const swatches = (reports[m.id]?.picks ?? []).flatMap((p) => p.swatches ?? []).slice(0, 4);
          return (
            <li key={m.id}>
              <Link href={`/stylist/${m.id}`} className="group block overflow-hidden rounded-[16px]" style={{ background: m.tint }}>
                <ModuleVisual module={m} portrait={picture} className="aspect-[4/3] w-full" />
                <div className="px-3 py-2">
                  <p className="truncate text-[12px] font-semibold text-[#121821] group-hover:underline">{m.title}</p>
                  {swatches.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {swatches.map((sw) => (
                        <span key={sw.hex + sw.name} title={sw.name} className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]" style={{ background: sw.hex }} />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Saved: the person's finished AI Stylist reports (the newest of each), each with their photo styled the way that
 * report looks and its main picks, one tap from the full report. Reading them costs nothing.
 */
export function SavedStylist() {
  const studio = useSavedStudio();

  if (studio === undefined) return <p className="text-[13px] text-[#5d6874]">Loading…</p>;
  const reports = studio?.reports ?? {};
  const picture = portraitUrl(studio?.portrait ?? null);
  const done = STUDIO_MODULES.filter((m) => reports[m.id]);
  if (!done.length) {
    return (
      <p className="rounded-[18px] bg-white px-5 py-6 text-[14px] text-[#4f5b66]">
        No AI Stylist reports yet.{" "}
        <Link href="/stylist" className="font-semibold text-[#121821] underline underline-offset-4">
          Open AI Stylist
        </Link>
      </p>
    );
  }

  return (
    <section aria-label="AI Stylist reports">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {done.map((m) => {
          const r = reports![m.id]!;
          return (
            <li key={m.id}>
              <Link href={`/stylist/${m.id}`} className="flex h-full flex-col overflow-hidden rounded-[20px] transition-transform hover:-translate-y-0.5" style={{ background: m.tint }}>
                <ModuleVisual module={m} portrait={picture} className="aspect-[4/3] w-full" />
                <div className="flex flex-1 flex-col p-5">
                <p className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[2px]" style={{ color: m.accent }}>
                  <span className="flex items-center gap-1.5">
                    <PaletteIcon className="h-3.5 w-3.5" /> {m.label}
                  </span>
                  <span className="normal-case tracking-normal text-[#5d6874]">{day(r.createdAt)}</span>
                </p>
                <h3 className="mt-2 font-display text-[22px] leading-tight text-[#121821]">{m.title}</h3>
                <dl className="mt-3 flex flex-1 flex-col gap-2.5">
                  {(r.picks ?? []).map((p) => (
                    <div key={p.label}>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-[#5d6874]">{p.label}</dt>
                      {p.value && <dd className="mt-0.5 text-[14px] font-medium text-[#121821]">{p.value}</dd>}
                      {p.swatches?.length ? (
                        <dd className="mt-1">
                          <PickSwatches pick={p} size="sm" />
                        </dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
                <span className="mt-4 text-[12.5px] font-semibold text-[#121821]">See your report →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
