"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PaletteIcon } from "@/components/Icons";
import { PickSwatches } from "@/components/studio/TopPicks";
import { STUDIO_MODULES, type ReportSummary, type StudioModuleId } from "@/lib/studioModules";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Saved: the person's finished AI Stylist reports (the newest of each), with their main picks, one tap from the full
 * report. Reading them costs nothing. Shows nothing until there's at least one.
 */
export function SavedStylist() {
  const [reports, setReports] = useState<Partial<Record<StudioModuleId, ReportSummary>> | null>(null);

  useEffect(() => {
    fetch("/api/studio")
      .then(async (res) => (res.ok ? ((await res.json()) as { reports: Partial<Record<StudioModuleId, ReportSummary>> }).reports : null))
      .then(setReports)
      .catch(() => {});
  }, []);

  const done = STUDIO_MODULES.filter((m) => reports?.[m.id]);
  if (!done.length) return null;

  return (
    <section className="mb-10" aria-labelledby="saved-stylist">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="saved-stylist" className="font-display text-[28px] leading-none text-[#121821]">
          AI Stylist
        </h2>
        <Link href="/stylist" className="text-[12.5px] font-semibold text-[#121821] underline-offset-4 hover:underline">
          Open AI Stylist
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {done.map((m) => {
          const r = reports![m.id]!;
          return (
            <li key={m.id}>
              <Link href={`/stylist/${m.id}`} className="flex h-full flex-col rounded-[20px] p-5 transition-transform hover:-translate-y-0.5" style={{ background: m.tint }}>
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
