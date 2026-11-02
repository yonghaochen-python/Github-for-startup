"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "@/components/Icons";
import { CreditsLine, refreshCredits } from "@/components/Credits";
import { ErrorNote, PageShell, btnPrimary, btnSecondary, btnText } from "@/components/ui";
import { ColorReport } from "@/components/studio/ColorReport";
import { HairReport } from "@/components/studio/HairReport";
import { MakeupReport } from "@/components/studio/MakeupReport";
import { Feedback } from "@/components/Feedback";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { PortraitControls } from "@/components/studio/PortraitPanel";
import { StyleReport } from "@/components/studio/StyleReport";
import type { StyledPiece } from "@/lib/closetLook";
import { drawReportCard } from "@/components/studio/reportCard";
import { portraitUrl, useStudio } from "@/components/studio/useStudio";
import { isStudioModule, portraitReadiness, studioModule, type ReportSummary, type StudioModule, type StudioReportData } from "@/lib/studioModules";

type Report = { id: string; data: StudioReportData; practice: boolean; createdAt: string; portraitVersion: string | null };
type Loaded = { report: Report | null; history: ReportSummary[]; generating: boolean };

const LOADING_STEPS = ["Looking at your portrait…", "Reading your coloring…", "Putting your report together…", "Almost there…"];
const longDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <li className="flex flex-col gap-2">
      <span className="aspect-square w-full rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.1)]" style={{ background: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#ccc" }} />
      <span className="text-[12.5px] font-medium leading-tight text-[#121821]">{name}</span>
      <span className="-mt-1.5 text-[11px] uppercase tracking-[1px] text-[#5d6874]">{hex}</span>
    </li>
  );
}

/** A finished report, laid out like a magazine page in the module's own colors. */
function ReportView({ module, report, portrait }: { module: StudioModule; report: Report; portrait: string | null }) {
  const d = report.data;
  return (
    <article className="overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(18,30,45,0.1)]" style={{ background: module.tint }}>
      <div className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
            AI Stylist · {module.label} · {longDay(report.createdAt)}
          </p>
          <h2 className="mt-6 font-display text-[46px] font-normal leading-[1] tracking-[-1px] text-[#121821] sm:text-[64px]">{d.headline}</h2>
          {d.keywords.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {d.keywords.map((k) => (
                <li key={k} className="text-[11.5px] font-medium uppercase tracking-[2px] text-[#4f5b66]">
                  {k}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-[#2b3540]">{d.summary}</p>
        </div>
        <div className="mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-t-full bg-white/60">
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="Your portrait" className="h-full w-full object-cover" />
          )}
        </div>
      </div>

      {d.palette.length > 0 && (
        <section className="bg-white/70 px-7 py-9 sm:px-12">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[2.6px] text-[#5d6874]">Palette</p>
          <ul className="grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-8">
            {d.palette.map((s) => (
              <Swatch key={`${s.name}${s.hex}`} {...s} />
            ))}
          </ul>
        </section>
      )}

      {d.sections.length > 0 && (
        <section className="grid gap-x-12 gap-y-8 bg-white px-7 py-10 sm:px-12 md:grid-cols-2">
          {d.sections.map((s) => (
            <div key={s.title}>
              <h3 className="font-display text-[26px] leading-tight text-[#121821]">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#4f5b66]">{s.body}</p>
            </div>
          ))}
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 bg-white px-7 pb-8 pt-2 text-[11.5px] text-[#5d6874] sm:px-12">
        <span>
          Confidence: <span className="font-semibold text-[#121821]">{d.confidence}</span>
          {d.limits ? ` · ${d.limits}` : ""}
        </span>
        <span>A styling suggestion from one photo, not a definitive assessment.</span>
      </footer>
    </article>
  );
}

/**
 * One Studio analysis: what it covers and an Analyze button until it's made, then the report, which opens again
 * for free. Regenerate makes a new one and keeps the old one in Earlier reports.
 */
export default function StudioModulePage() {
  const params = useParams<{ module: string }>();
  const id = params.module;
  const valid = isStudioModule(id);
  const mod = valid ? studioModule(id) : null;
  const { state, savePortrait } = useStudio();
  // The photo can be changed right here (opened from the report, or when the AI couldn't read it).
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [photoProblem, setPhotoProblem] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  // One id per press of Analyze, so a repeated request is answered once, never made twice.
  const requestId = useRef<string | null>(null);

  async function load(reportId?: string) {
    const res = await fetch(`/api/studio/reports/${id}${reportId ? `?id=${reportId}` : ""}`).catch(() => null);
    if (res?.ok) setLoaded((await res.json()) as Loaded);
    else setError("This report didn't load. Please refresh the page.");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once per mod
    if (valid) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mod
  }, [id, valid]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2500);
    return () => clearInterval(timer);
  }, [busy]);

  if (!mod) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-12">
          <p className="text-[14px] text-[#4f5b66]">
            This analysis doesn&apos;t exist.{" "}
            <Link href="/stylist" className="font-semibold text-[#121821] underline underline-offset-4">
              Back to AI Stylist
            </Link>
          </p>
        </PageShell>
      </main>
    );
  }

  const portrait = state?.portrait ?? null;
  const picture = portraitUrl(portrait);
  const readiness = portraitReadiness(portrait?.checks ?? null);
  const report = loaded?.report ?? null;
  const reportPicture = picture;
  // A report made from an earlier photo still opens; it says so and offers a new one.
  const fromEarlierPhoto = Boolean(report && portrait && report.portraitVersion && report.portraitVersion !== portrait.version);

  async function analyze() {
    if (busy) return;
    setBusy(true);
    setStep(0);
    setError(null);
    setPhotoProblem(false);
    setChangingPhoto(false);
    requestId.current ??= crypto.randomUUID();
    try {
      const res = await fetch(`/api/studio/reports/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current }),
      });
      const data = (await res.json().catch(() => ({}))) as { report?: Report; error?: string; code?: string };
      setPhotoProblem(data.code === "unusable");
      if (!res.ok || !data.report) throw new Error(data.error ?? "This analysis couldn't be made. Please try again.");
      requestId.current = null;
      refreshCredits();
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "This analysis couldn't be made. Please try again.");
      // A failed request can be retried with the same id; a fresh press after an error gets a new one.
      requestId.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function card(): Promise<File | null> {
    if (!report) return null;
    setCardBusy(true);
    try {
      const blob = await drawReportCard(mod!, report.data, reportPicture, longDay(report.createdAt));
      return new File([blob], `virm-${mod!.id}-report.png`, { type: "image/png" });
    } catch {
      setError("Couldn't make the picture. Please try again.");
      return null;
    } finally {
      setCardBusy(false);
    }
  }

  async function download() {
    const file = await card();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    const file = await card();
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: mod!.title }).catch(() => {});
    } else {
      const url = URL.createObjectURL(file);
      window.open(url, "_blank");
    }
  }

  /** Saves the closet look with a piece swapped or taken out (shown straight away). */
  async function changeLook(pieces: StyledPiece[]) {
    if (!report || !loaded) return;
    const extra = { ...(report.data.extra ?? {}), look: { ...(report.data.extra?.look as object), pieces } };
    setLoaded({ ...loaded, report: { ...report, data: { ...report.data, extra } } });
    const res = await fetch(`/api/studio/reports/${id}?id=${report.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pieces }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't save that change. Please try again.");
      await load(report.id);
    }
  }

  async function deleteThis() {
    if (!report || !confirm("Delete this report? This can't be undone.")) return;
    const res = await fetch(`/api/studio/reports/${id}?id=${report.id}`, { method: "DELETE" });
    if (res.ok) await load();
    else setError("Couldn't delete it right now. Please try again.");
  }

  const canAnalyze = Boolean(portrait) && !busy && !loaded?.generating;

  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-6 sm:pt-8">
        <Link href="/stylist" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4f5b66] hover:text-[#121821]">
          <ArrowLeftIcon className="h-4 w-4" /> AI Stylist
        </Link>

        {error && (
          <div className="mb-6">
            <ErrorNote message={error} />
            {photoProblem && (
              // The AI couldn't read this photo: change it right here, then press Analyze again.
              <div className="mt-4 rounded-[18px] bg-white p-5 shadow-[0_8px_22px_rgba(18,30,45,0.06)]">
                <p className="mb-3 text-[14px] font-semibold text-[#121821]">Try a different photo</p>
                <PortraitControls portrait={portrait} savePortrait={savePortrait} />
              </div>
            )}
          </div>
        )}

        {!loaded && !error && <p className="text-[13px] text-[#5d6874]">Loading…</p>}

        {/* Being made: a clear waiting state. */}
        {loaded && (busy || loaded.generating) && (
          <section className="overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(18,30,45,0.1)]" style={{ background: mod.tint }}>
            <ModuleVisual module={mod} portrait={picture} className="aspect-[16/7] w-full animate-pulse" />
            <div className="p-8 text-center sm:p-10" role="status" aria-live="polite">
              <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: mod.accent }}>
                {mod.title}
              </p>
              <p className="mt-3 font-display text-[32px] leading-tight text-[#121821]">{busy ? LOADING_STEPS[step] : "Your report is being made…"}</p>
              <p className="mt-2 text-[13px] text-[#5d6874]">Keep this page open. It usually takes under a minute.</p>
              {!busy && (
                <button onClick={() => load()} className={`${btnText} mt-2`}>
                  Check again
                </button>
              )}
            </div>
          </section>
        )}

        {/* Not made yet: what it covers, and Analyze. */}
        {loaded && !report && !busy && !loaded.generating && (
          <section className="grid overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(18,30,45,0.1)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <ModuleVisual module={mod} portrait={picture} className="aspect-[4/3] w-full md:aspect-auto md:min-h-[460px]" />
            <div className="flex flex-col p-7 sm:p-10">
              <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: mod.accent }}>
                AI Stylist · {mod.label}
              </p>
              <h1 className="mt-3 font-display text-[42px] leading-[1] tracking-[-1px] text-[#121821] sm:text-[52px]">{mod.title}</h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4f5b66]">{mod.description}</p>
              <ul className="mt-6 space-y-2.5">
                {mod.covers.map((c) => (
                  <li key={c} className="flex gap-2.5 text-[14px] text-[#2b3540]">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                {/* The photo it will use, and a way to change it before analyzing. */}
                <div className="mb-6 flex gap-4">
                  <div className="h-24 w-[76px] shrink-0 overflow-hidden rounded-[12px] bg-[#e9edf1]">
                    {picture && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={picture} alt="The photo this analysis will use" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <PortraitControls portrait={portrait} savePortrait={savePortrait} showTips={!portrait || !readiness.ready} />
                  </div>
                </div>
                {portrait && (
                  <>
                    <button onClick={analyze} disabled={!canAnalyze} className={btnPrimary}>
                      Analyze
                    </button>
                    <div className="mt-3 max-w-sm">
                      <CreditsLine kind="photo" />
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#5d6874]">
                      Uses one photo credit, only if your report is made. Your portrait goes to our AI provider for this analysis; the report is saved to open
                      again for free.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* The report. */}
        {loaded && report && !busy && !loaded.generating && (
          <>
            {report.practice && (
              <p className="mb-4 rounded-[14px] bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">Practice report: no AI was used and nothing was counted.</p>
            )}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h1 className="mr-auto font-display text-[30px] leading-none text-[#121821] sm:text-[36px]">{mod.title}</h1>
              <button onClick={() => setChangingPhoto((v) => !v)} className={btnSecondary}>
                {changingPhoto ? "Close" : "Change photo"}
              </button>
              <button onClick={download} disabled={cardBusy} className={btnSecondary}>
                Download image
              </button>
              <button onClick={share} disabled={cardBusy} className={btnSecondary}>
                Share
              </button>
            </div>
            {(changingPhoto || fromEarlierPhoto) && (
              <div className="mb-5 rounded-[18px] bg-white p-5 shadow-[0_8px_22px_rgba(18,30,45,0.06)]">
                {fromEarlierPhoto && (
                  <p className="mb-3 text-[13.5px] text-[#2b3540]">
                    This report was made from an earlier photo.{" "}
                    <button onClick={analyze} disabled={!canAnalyze} className="font-semibold text-[#121821] underline underline-offset-4">
                      Make a new one with your current photo
                    </button>{" "}
                    (one photo credit).
                  </p>
                )}
                {changingPhoto && <PortraitControls portrait={portrait} savePortrait={savePortrait} />}
              </div>
            )}
            {mod.id === "color" && report.data.extra ? (
              <ColorReport module={mod} data={report.data} portrait={reportPicture} createdAt={report.createdAt} />
            ) : mod.id === "hair" && report.data.extra ? (
              <HairReport module={mod} data={report.data} portrait={reportPicture} createdAt={report.createdAt} />
            ) : mod.id === "makeup" && report.data.extra ? (
              <MakeupReport module={mod} data={report.data} portrait={reportPicture} createdAt={report.createdAt} />
            ) : mod.id === "style" && report.data.extra ? (
              <StyleReport module={mod} data={report.data} portrait={reportPicture} createdAt={report.createdAt} onLookChange={changeLook} />
            ) : (
              <ReportView module={mod} report={report} portrait={reportPicture} />
            )}
            <Feedback kind="stylist" targetId={report.id} className="mt-5 justify-center rounded-[16px] bg-white px-4 py-3" />
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              {loaded.history.length > 1 && (
                <label className="flex items-center gap-2 text-[13px] text-[#4f5b66]">
                  Earlier reports
                  <select value={report.id} onChange={(e) => load(e.target.value)} className="rounded-full bg-white px-3 py-1.5 text-[13px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]">
                    {loaded.history.map((h) => (
                      <option key={h.id} value={h.id}>
                        {longDay(h.createdAt)}
                        {h.practice ? " (practice)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                onClick={() => confirm("Make a new report? This one stays in Earlier reports.") && analyze()}
                disabled={!canAnalyze}
                className={btnText}
              >
                Regenerate
              </button>
              <button onClick={deleteThis} className={`${btnText} text-[#5d6874]`}>
                Delete this report
              </button>
            </div>
          </>
        )}
      </PageShell>
    </main>
  );
}
