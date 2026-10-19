"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminStats } from "@/lib/adminStats";
import { BarChart, HBars, LineChart } from "@/components/admin/Charts";
import { InlineLoading } from "@/components/InlineLoading";
import { ErrorNote, PageHeader, PageShell, btnSecondary, eyebrow } from "@/components/ui";

type Account = { email: string; createdAt: string; lastActiveAt: string | null; closetItems: number; outfits: number };
type Preset = "today" | "7" | "30" | "custom";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const secs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

function rangeFor(preset: Preset, custom: { from: string; to: string }) {
  const today = iso(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "custom") return custom;
  return { from: iso(new Date(Date.now() - (Number(preset) - 1) * DAY)), to: today };
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border border-[#dce2e4] bg-white/70 px-4 py-4">
      <p className="text-[11px] font-semibold text-[#5f6a70]">{label}</p>
      <p className="mt-1 font-display text-[34px] leading-none text-[#1c2328]">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-[#8b969c]">{hint}</p>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[28px] font-normal text-[#1c2328]">{title}</h2>
      {description && <p className="mb-4 mt-1 max-w-2xl text-[13px] text-[#5f6a70]">{description}</p>}
      {children}
    </section>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string | null }) {
  return (
    <div className="border border-[#dce2e4] bg-white/70 p-4">
      <p className="mb-2 text-[12px] font-semibold text-[#3b4850]">{title}</p>
      {empty ? <p className="py-10 text-center text-[12.5px] text-[#8b969c]">{empty}</p> : children}
    </div>
  );
}

export default function AdminPage() {
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState(() => ({ from: iso(new Date(Date.now() - 13 * DAY)), to: iso(new Date()) }));
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: { from: string; to: string }) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?from=${range.from}&to=${range.to}`, { cache: "no-store" });
      if (res.status === 404 || res.status === 401) return setState("denied");
      const data = (await res.json().catch(() => ({}))) as { stats?: AdminStats; error?: string };
      if (!res.ok || !data.stats) throw new Error(data.error ?? "Couldn't load the statistics.");
      setStats(data.stats);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the statistics.");
      setState((s) => (s === "loading" ? "error" : s));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the preset changes
    if (preset !== "custom") load(rangeFor(preset, custom));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- custom range loads on Apply
  }, [preset, load]);

  useEffect(() => {
    fetch("/api/admin/accounts", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { accounts: Account[] }).accounts : null))
      .then(setAccounts)
      .catch(() => {});
  }, []);

  if (state === "denied") {
    return (
      <main className="flex-1">
        <PageShell>
          <PageHeader title="Page not found" description="This page doesn't exist." />
        </PageShell>
      </main>
    );
  }
  if (state === "loading" || !stats) {
    return (
      <main className="flex-1">
        {state === "error" && error ? (
          <PageShell className="pt-10">
            <ErrorNote message={error} />
          </PageShell>
        ) : (
          <InlineLoading label="Loading dashboard…" />
        )}
      </main>
    );
  }

  const s = stats;
  const days = s.range.days;
  const tracking = s.trackingSince;
  const noEventsYet = !tracking;
  const summary =
    s.activity.activityTrend.label !== "not enough data"
      ? { basis: "active users per day", ...s.activity.activityTrend }
      : { basis: "new sign-ups per day", ...s.users.growthTrend };
  const featureRows = s.activity.featureUse
    .filter((f) => f.key !== "profile")
    .map((f) => ({ label: f.label, value: f.visits }));
  const topVisits = Math.max(0, ...featureRows.map((r) => r.value));
  const featuresMarked = featureRows.map((r) => ({
    ...r,
    note: topVisits >= 10 && r.value < topVisits * 0.2 ? "underused" : undefined,
  }));

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader
          label="Admin"
          title="Virm dashboard"
          description="Owner-only. Every number comes from your real database; days are counted in UTC. No photos or clothing details are shown here."
        />

        {/* Date filters */}
        <div className="flex flex-wrap items-end gap-3 border-b border-[#dce2e4] pb-5">
          <div role="tablist" aria-label="Date range" className="flex rounded-[6px] border border-[#cbd7dc] bg-white/60 p-1">
            {(
              [
                ["today", "Today"],
                ["7", "Last 7 days"],
                ["30", "Last 30 days"],
                ["custom", "Custom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={preset === value}
                onClick={() => setPreset(value)}
                className={`rounded-[4px] px-3.5 py-2 text-[12px] font-semibold ${
                  preset === value ? "bg-[#1c2328] text-white" : "text-[#5f6a70] hover:text-[#1c2328]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-semibold text-[#5f6a70]">
                From
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="mt-1 block min-h-[40px] rounded-[5px] border border-[#cbd7dc] bg-white px-2 text-[13px]" />
              </label>
              <label className="text-[11px] font-semibold text-[#5f6a70]">
                To
                <input type="date" value={custom.to} min={custom.from} max={iso(new Date())} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="mt-1 block min-h-[40px] rounded-[5px] border border-[#cbd7dc] bg-white px-2 text-[13px]" />
              </label>
              <button onClick={() => load(custom)} className={btnSecondary}>Apply</button>
            </div>
          )}
          <p className="ml-auto text-[12px] text-[#7e888e]">
            {fmtDate(s.range.from)} – {fmtDate(s.range.to)}
          </p>
        </div>
        {error && <div className="mt-4"><ErrorNote message={error} /></div>}

        {/* Tracking notice + summary */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="border border-[#cbd7dc] bg-[#1c2328] p-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[2.4px] text-[#a9b6bc]">Summary</p>
            <p className="mt-2 font-display text-[28px] leading-tight">
              {summary.label === "not enough data"
                ? "Not enough data yet to call a trend."
                : `Usage is ${summary.label}.`}
            </p>
            <p className="mt-2 text-[12.5px] text-[#c3cdd2]">
              {summary.label === "not enough data"
                ? "Needs at least a few days with activity in the selected range."
                : `Based on ${summary.basis}: second half of this range vs the first half${
                    summary.change != null ? ` (${summary.change > 0 ? "+" : ""}${Math.round(summary.change * 100)}%)` : ""
                  }.`}
            </p>
          </div>
          <div className="border border-[#cbd7dc] bg-white/70 p-5">
            <p className={eyebrow}>Data coverage</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#3b4850]">
              Sign-ups, closet uploads and outfits are counted from the start.{" "}
              {noEventsYet ? (
                <strong>Detailed activity tracking (visits, try-ons, success rates, timings) hasn&apos;t recorded anything yet.</strong>
              ) : (
                <>
                  Detailed activity tracking started on <strong>{fmtDate(tracking)}</strong> — earlier days show no activity
                  because it wasn&apos;t being recorded.
                </>
              )}
            </p>
          </div>
        </div>

        <Section title="User growth">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total users" value={s.users.total} />
            <Stat label="New today" value={s.users.newToday} />
            <Stat label="New this week" value={s.users.newWeek} hint="Last 7 days" />
            <Stat label="New this month" value={s.users.newMonth} hint="Last 30 days" />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="Total users over time">
              <LineChart days={days} values={s.users.totalPerDay} label="Total users per day" />
            </ChartCard>
            <ChartCard title={`New sign-ups per day (${s.users.newInRange} in range)`}>
              <BarChart days={days} values={s.users.newPerDay} label="New sign-ups per day" />
            </ChartCard>
          </div>
        </Section>

        <Section title="Activity" description="Active means the person used Virm while signed in. Feature visits are counted at most once per person per hour.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active, last 7 days" value={s.activity.active7} />
            <Stat label="Active, last 30 days" value={s.activity.active30} hint="Monthly active users" />
            <Stat label="Active in range" value={noEventsYet ? "—" : s.activity.activeInRange} />
            <Stat
              label="Days visited per person"
              value={s.activity.avgVisitDays == null ? "—" : s.activity.avgVisitDays.toFixed(1)}
              hint="Average, in range"
            />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="Daily active users" empty={noEventsYet ? "No activity recorded yet." : null}>
              <BarChart days={days} values={s.activity.activeByDay} label="Daily active users" />
            </ChartCard>
            <ChartCard title="Feature visits" empty={noEventsYet ? "No visits recorded yet." : null}>
              <HBars rows={featuresMarked} />
              <p className="mt-3 text-[11px] text-[#8b969c]">“Underused” = fewer than 20% of the most-used feature&apos;s visits.</p>
            </ChartCard>
          </div>
        </Section>

        <Section title="What people create">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Outfits generated" value={s.content.outfitsInRange} hint={`${s.content.outfitsTotal} all time`} />
            <Stat label="Looks saved" value={noEventsYet ? "—" : s.content.looksSavedInRange} hint={`${s.content.savedLooksTotal} saved right now`} />
            <Stat label="Clothing uploads" value={s.content.uploadsInRange} hint={`${s.content.uploadsTotal} all time`} />
            <Stat
              label="Users who created outfits"
              value={s.content.peopleWithOutfits}
              hint={`${s.content.peopleWithUploads} have uploaded clothes`}
            />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="Outfits generated per day">
              <BarChart days={days} values={s.content.outfitsPerDay} label="Outfits generated per day" />
            </ChartCard>
            <ChartCard title="Clothing uploads per day">
              <BarChart days={days} values={s.content.uploadsPerDay} label="Clothing uploads per day" />
            </ChartCard>
          </div>
        </Section>

        <Section title="Reliability and speed" description="Requests recorded since tracking started. Times are for successful requests: median and the slowest 5%.">
          <div className="overflow-x-auto border border-[#dce2e4] bg-white/70">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-b border-[#dce2e4] text-[11px] uppercase tracking-[1.2px] text-[#7e888e]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">Requests</th>
                  <th className="px-4 py-3 font-semibold">Failed</th>
                  <th className="px-4 py-3 font-semibold">Failure rate</th>
                  <th className="px-4 py-3 font-semibold">Median time</th>
                  <th className="px-4 py-3 font-semibold">Slowest 5%</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["AI outfit generation", s.performance.outfitGeneration],
                    ["Virtual try-on", s.performance.tryOn],
                    ["Clothes detection (Add Clothes)", s.performance.clothesDetection],
                  ] as const
                ).map(([name, p]) => (
                  <tr key={name} className="border-b border-[#eef1f2] last:border-0">
                    <td className="px-4 py-3 text-[#1c2328]">{name}</td>
                    <td className="px-4 py-3 tabular-nums">{p.total}</td>
                    <td className={`px-4 py-3 tabular-nums ${p.failed > 0 ? "text-[#a03a2f]" : ""}`}>{p.failed}</td>
                    <td className="px-4 py-3 tabular-nums">{pct(p.failureRate)}</td>
                    <td className="px-4 py-3 tabular-nums">{secs(p.medianMs)}</td>
                    <td className="px-4 py-3 tabular-nums">{secs(p.p95Ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="Try-on requests per day" empty={noEventsYet ? "No try-ons recorded yet." : null}>
              <BarChart days={days} values={s.performance.tryOn.perDay} label="Try-on requests per day" />
            </ChartCard>
            <ChartCard title="Outfit generations per day (tracked)" empty={noEventsYet ? "No generations recorded yet." : null}>
              <BarChart days={days} values={s.performance.outfitGeneration.perDay} label="Outfit generation requests per day" />
            </ChartCard>
          </div>
        </Section>

        <Section title="Retention" description="Of the people who signed up at least 7 days ago, how many came back on a later day.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Came back" value={pct(s.retention.rate)} hint={`${s.retention.returned} of ${s.retention.eligible} people`} />
          </div>
          <p className="mt-2 text-[11.5px] text-[#8b969c]">
            &ldquo;Came back&rdquo; uses last-active dates, which only started being recorded with tracking — it will become more
            accurate over time.
          </p>
        </Section>

        <Section title="Accounts" description="Minimal information only: emails are partly hidden, and there's no access to anyone's closet or photos.">
          {!accounts ? (
            <p className="text-[12.5px] text-[#8b969c]">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="text-[12.5px] text-[#8b969c]">No accounts yet.</p>
          ) : (
            <div className="overflow-x-auto border border-[#dce2e4] bg-white/70">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="border-b border-[#dce2e4] text-[11px] uppercase tracking-[1.2px] text-[#7e888e]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Last active</th>
                    <th className="px-4 py-3 font-semibold">Closet items</th>
                    <th className="px-4 py-3 font-semibold">Outfits</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, i) => (
                    <tr key={i} className="border-b border-[#eef1f2] last:border-0">
                      <td className="px-4 py-2.5 text-[#1c2328]">{a.email}</td>
                      <td className="px-4 py-2.5">{fmtDate(a.createdAt)}</td>
                      <td className="px-4 py-2.5">{a.lastActiveAt ? fmtDate(a.lastActiveAt) : "Not yet recorded"}</td>
                      <td className="px-4 py-2.5 tabular-nums">{a.closetItems}</td>
                      <td className="px-4 py-2.5 tabular-nums">{a.outfits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </PageShell>
    </main>
  );
}
