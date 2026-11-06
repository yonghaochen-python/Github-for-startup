"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClothingItem } from "@/components/OutfitCard";
import type { PlanDays } from "@/lib/planOutfits";
import { ErrorNote, PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import { InlineLoading } from "@/components/InlineLoading";
import { useAuth } from "@/components/AuthProvider";
import { retryImage } from "@/lib/retryImage";
import { DayEditor } from "@/components/planner/DayEditor";
import type { Palette } from "@/components/ClosetPicker";
import { profileColors, type StyleProfile } from "@/lib/styleProfile";

/**
 * Planner: a month of outfits from the person's own closet. Generate Plan fills today on (this month) or every day
 * (a future month) for free, no AI; each day shows its pieces. Tapping a day opens it.
 */

const ORDER = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n: number) => String(n).padStart(2, "0");
/** Today in the person's own time zone, "2026-11-06". */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
const monthName = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
function datesOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
}
/** 0 = Monday … 6 = Sunday. */
const weekday = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

/** A day's pieces as a small flat-lay (up to four, top layers first). */
function FlatLay({ pieces, size = "grid" }: { pieces: ClothingItem[]; size?: "grid" | "row" }) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));
  const img = (p: ClothingItem) => (
    // eslint-disable-next-line @next/next/no-img-element -- the person's own closet pictures
    <img
      key={p.id}
      src={p.imageUrl}
      alt=""
      loading="lazy"
      onError={retryImage}
      className={`h-full w-full ${p.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-0.5" : "object-cover"}`}
    />
  );
  if (size === "row") {
    return (
      <span className="flex min-w-0 gap-1.5">
        {sorted.slice(0, 5).map((p) => (
          <span key={p.id} className="h-[72px] w-[58px] shrink-0 overflow-hidden rounded-[10px] bg-white">
            {img(p)}
          </span>
        ))}
      </span>
    );
  }
  const shown = sorted.slice(0, 4);
  return (
    <span className={`grid h-full w-full gap-0.5 ${shown.length > 1 ? "grid-cols-2" : ""} ${shown.length > 2 ? "grid-rows-2" : ""}`}>
      {shown.map((p, i) => (
        <span key={p.id} className={`min-h-0 overflow-hidden rounded-[6px] bg-white ${shown.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          {img(p)}
        </span>
      ))}
    </span>
  );
}

export default function PlannerPage() {
  const { status } = useAuth();
  // The date comes from the browser (the person's own time zone), so the page waits for it.
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [days, setDays] = useState<PlanDays>({});
  const [closet, setCloset] = useState<ClothingItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [ranOut, setRanOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The day open in the editor.
  const [editing, setEditing] = useState<string | null>(null);
  // The Style Profile's colors, for the closet's color filter (read only; nothing is generated).
  const [palette, setPalette] = useState<Palette | null | undefined>(undefined);

  useEffect(() => {
    const t = localToday();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the date is only known in the browser
    setToday(t);
    setMonth(t.slice(0, 7));
  }, []);

  useEffect(() => {
    if (status !== "signedIn") return;
    fetch("/api/closet/items", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { items: ClothingItem[] }).items : []))
      .then(setCloset)
      .catch(() => setCloset([]));
  }, [status]);

  useEffect(() => {
    if (status !== "signedIn") return;
    fetch("/api/studio")
      .then(async (res) => (res.ok ? ((await res.json()) as { profile?: StyleProfile }).profile : undefined))
      .then((profile) => setPalette(profile ? profileColors(profile) : null))
      .catch(() => setPalette(null));
  }, [status]);

  useEffect(() => {
    if (!month || status !== "signedIn") return;
    let ignore = false;
    fetch(`/api/planner?month=${month}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { days: PlanDays }).days : {}))
      .then((d) => !ignore && setDays(d))
      .catch(() => !ignore && setDays({}))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [month, status]);

  const byId = useMemo(() => new Map((closet ?? []).map((p) => [p.id, p])), [closet]);
  const piecesOf = useCallback((date: string) => (days[date]?.items ?? []).flatMap((id) => byId.get(id) ?? []), [days, byId]);

  const generate = useCallback(
    async (replace = false) => {
      if (!month || !today) return;
      setConfirm(false);
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch("/api/planner/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ month, today, replace }),
        });
        const data = (await res.json().catch(() => ({}))) as { days?: PlanDays; ranOut?: boolean; exists?: boolean; error?: string };
        if (res.status === 409 && data.exists) setConfirm(true);
        else if (!res.ok || !data.days) setError(data.error ?? "Couldn't make the plan. Try again.");
        else {
          setDays(data.days);
          setRanOut(Boolean(data.ranOut));
        }
      } catch {
        setError("Couldn't make the plan. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [month, today]
  );

  /** Another month: its plan loads (notes from this one are cleared). */
  function changeMonth(by: number) {
    if (!month) return;
    setLoading(true);
    setRanOut(false);
    setError(null);
    setMonth(shiftMonth(month, by));
  }

  /** Opens a day: one with an outfit, or an empty one from today on (to build by hand). */
  const openDay = (date: string) => {
    if (piecesOf(date).length || (today && date >= today)) setEditing(date);
  };

  if (!today || !month || status !== "signedIn" || closet === null) {
    return (
      <main className="flex-1">
        <InlineLoading label="Loading…" />
      </main>
    );
  }

  const dates = datesOf(month);
  const past = month < today.slice(0, 7);
  const lead = weekday(dates[0]);
  const hasPlan = Object.keys(days).length > 0;

  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-8 sm:pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="sr-only">Planner</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] text-[#121821] hover:bg-black/5">
                ‹
              </button>
              <p className="min-w-[230px] text-center font-display text-[40px] font-normal leading-none tracking-[-1px] text-[#121821] sm:min-w-[300px] sm:text-[52px]" aria-live="polite">
                {monthName(month)}
              </p>
              <button onClick={() => changeMonth(1)} aria-label="Next month" className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] text-[#121821] hover:bg-black/5">
                ›
              </button>
            </div>
          </div>
          {closet.length === 0 ? (
            <Link href="/closet?add=1" className={btnPrimary}>
              Add clothes
            </Link>
          ) : (
            !past && (
              <button onClick={() => generate(false)} disabled={generating || loading} className={btnPrimary}>
                {generating ? "Planning…" : "Generate Plan"}
              </button>
            )
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorNote message={error} />
          </div>
        )}
        {ranOut && <p className="mb-6 text-[13px] text-[#5d6874]">Add more pieces for more variety.</p>}

        {/* Computers: the month as a grid, Monday first. */}
        <div className={`hidden md:block ${loading ? "opacity-50" : ""}`}>
          <div className="mb-2 grid grid-cols-7 gap-2.5">
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-1 text-[10.5px] font-semibold uppercase tracking-[1.8px] text-[#7a858f]">
                {d}
              </span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-2.5">
            {Array.from({ length: lead }, (_, i) => (
              <li key={`lead-${i}`} aria-hidden />
            ))}
            {dates.map((date) => {
              const pieces = piecesOf(date);
              const isToday = date === today;
              const before = date < today;
              return (
                <li key={date}>
                  <button
                    onClick={() => openDay(date)}
                    disabled={!pieces.length && before}
                    aria-label={`${new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}${pieces.length ? "" : ", no outfit"}`}
                    className={`group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[16px] p-2 text-left transition-shadow ${
                      pieces.length ? "bg-white shadow-[0_8px_24px_rgba(18,30,45,0.06)] hover:shadow-[0_14px_34px_rgba(18,30,45,0.12)]" : "bg-white/40"
                    } ${before ? "opacity-45" : ""}`}
                  >
                    <span
                      className={`mb-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold ${
                        isToday ? "bg-[#121821] text-white" : "text-[#29343a]"
                      }`}
                    >
                      {Number(date.slice(8))}
                    </span>
                    {pieces.length > 0 && (
                      <span className="min-h-0 flex-1 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                        <FlatLay pieces={pieces} />
                      </span>
                    )}
                    {days[date] && days[date].source !== "generated" && (
                      <span aria-hidden className="absolute right-2.5 top-3 h-1.5 w-1.5 rounded-full bg-[#c9a227]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Phones: one row per day, the pieces large enough to see. */}
        <ol className={`flex flex-col md:hidden ${loading ? "opacity-50" : ""}`}>
          {dates
            .filter((date) => date >= today || piecesOf(date).length || !hasPlan)
            .map((date) => {
              const pieces = piecesOf(date);
              const isToday = date === today;
              return (
                <li key={date} className={`border-b border-black/[0.06] ${weekday(date) === 0 ? "mt-3" : ""} ${date < today ? "opacity-45" : ""}`}>
                  <button onClick={() => openDay(date)} disabled={!pieces.length && date < today} className="flex w-full items-center gap-4 py-3 text-left">
                    <span className="w-11 shrink-0 text-center">
                      <span className="block text-[10px] font-semibold uppercase tracking-[1.4px] text-[#7a858f]">{WEEKDAYS[weekday(date)]}</span>
                      <span
                        className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full font-display text-[20px] leading-none ${
                          isToday ? "bg-[#121821] text-white" : "text-[#121821]"
                        }`}
                      >
                        {Number(date.slice(8))}
                      </span>
                    </span>
                    {pieces.length ? <FlatLay pieces={pieces} size="row" /> : <span className="h-[72px]" />}
                    {days[date] && days[date].source !== "generated" && <span aria-hidden className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a227]" />}
                  </button>
                </li>
              );
            })}
        </ol>
      </PageShell>

      {editing && (
        <DayEditor
          key={editing}
          date={editing}
          today={today}
          day={days[editing]}
          closet={closet}
          palette={palette}
          onClose={() => setEditing(null)}
          onSaved={(day) => {
            setDays((all) => {
              const next = { ...all };
              if (day) next[editing] = day;
              else delete next[editing];
              return next;
            });
            setEditing(null);
          }}
        />
      )}

      {/* Asked before a month's plan is replaced (days edited by hand are kept). */}
      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => setConfirm(false)}>
          <div role="dialog" aria-label="Replace this month's plan?" onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] rounded-[24px] bg-white p-6 shadow-[0_40px_90px_rgba(0,0,0,0.3)]">
            <p className="font-display text-[28px] leading-tight text-[#121821]">Replace {monthName(month)}?</p>
            <p className="mt-2 text-[14px] text-[#4f5b66]">Days you edited stay.</p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={() => generate(true)} className={btnPrimary}>
                Replace
              </button>
              <button onClick={() => setConfirm(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
