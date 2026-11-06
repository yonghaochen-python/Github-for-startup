"use client";

import { useEffect, useState, useRef } from "react";
import { useDialog } from "@/lib/useDialog";
import Link from "next/link";
import { PaletteIcon } from "@/components/Icons";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { PickSwatches } from "@/components/studio/TopPicks";
import { portraitUrl } from "@/components/studio/useStudio";
import { STUDIO_MODULES, type PortraitInfo, type ReportSummary, type StudioModule, type StudioModuleId } from "@/lib/studioModules";
import { btnPrimary, btnSecondary } from "@/components/ui";

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
 * Home's Saved Looks: the finished AI Stylist reports as small tiles (their styled photo, name and first colors);
 * a tap opens a pop-up with the report's main picks. Nothing shows until there's at least one.
 */
export function SavedStylistStrip() {
  const studio = useSavedStudio();
  const [open, setOpen] = useState<StudioModule | null>(null);
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
              <button onClick={() => setOpen(m)} className="group block w-full overflow-hidden rounded-[16px] text-left" style={{ background: m.tint }}>
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
              </button>
            </li>
          );
        })}
      </ul>
      {open && reports[open.id] && <ReportPeek module={open} report={reports[open.id]!} picture={picture} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** A saved report in a pop-up: the styled photo and its main picks, with the full report one tap away. */
function ReportPeek({ module: m, report, picture, onClose }: { module: StudioModule; report: ReportSummary; picture: string | null; onClose: () => void }) {
  const peekDialog = useRef<HTMLDivElement | null>(null);
  useDialog(peekDialog, onClose, { escape: false });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,16,24,0.55)] sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={peekDialog}
        role="dialog"
        aria-modal="true"
        aria-label={m.title}
        onClick={(e) => e.stopPropagation()}
        className="relative grid max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-t-[22px] bg-white shadow-[0_24px_60px_rgba(10,16,24,0.3)] sm:rounded-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[18px] text-[#29343a] shadow-sm hover:text-[#121821]">
          ×
        </button>
        <ModuleVisual module={m} portrait={picture} className="aspect-[4/3] w-full md:aspect-auto md:h-full md:min-h-[380px]" />
        <div className="flex flex-col p-6 sm:p-8">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[2px]" style={{ color: m.accent }}>
            <PaletteIcon className="h-3.5 w-3.5" /> {m.label} · <span className="normal-case tracking-normal text-[#5d6874]">{day(report.createdAt)}</span>
          </p>
          <h2 className="mt-2 font-display text-[30px] leading-tight text-[#121821]">{m.title}</h2>
          <dl className="mt-4 flex flex-1 flex-col gap-3.5">
            {(report.picks ?? []).map((p) => (
              <div key={p.label}>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-[#5d6874]">{p.label}</dt>
                {p.value && <dd className="mt-0.5 text-[15px] font-medium text-[#121821]">{p.value}</dd>}
                {p.swatches?.length ? (
                  <dd className="mt-1.5">
                    <PickSwatches pick={p} size="sm" />
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/stylist/${m.id}`} className={btnPrimary}>
              See full report
            </Link>
            <button onClick={onClose} className={btnSecondary}>
              Close
            </button>
          </div>
        </div>
      </div>
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
