"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CostAssumptions, PackAssumption, PlanKey } from "@/lib/businessCosts";
import { eyebrow, surface } from "@/components/ui";

/**
 * The admin Costs & break-even calculator. All inputs are editable and kept in this browser only (nothing is sent
 * or saved on the server); "Reset" goes back to the defaults the server sent. Every result is an estimate.
 *
 * Formulas (per month, for a scenario's usage share u):
 *   Claude per user           = clothing photos added × Claude per photo + "Style it" requests × Claude per request
 *   AI cost per user          = photos × u × photo cost + lives × u × live cost + Claude per user + other AI per user
 *   Contribution per user     = price − payment fee − AI cost per user
 *   Pack contribution         = price − fee − credits × u × cost per try-on   (per pack sold)
 *   Free users' cost          = free users × AI cost per free user
 *   Profit                    = all revenue − payment fees − AI costs − hosting − other expenses
 *   Margin                    = profit ÷ revenue
 *   Break-even subscribers    = ⌈(hosting + other + free users' cost) ÷ contribution per subscriber⌉ (no other paid users)
 */

// Bumped when the assumptions' shape changes, so older saved edits aren't read into the new shape.
const STORE_KEY = "virm-admin-costs-v2";
const PLAN_KEYS: PlanKey[] = ["free", "plus", "pro"];
const PAID = ["plus", "pro"] as const;

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctText = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const packName = (p: PackAssumption) => `${p.credits} ${p.kind === "live" ? "live sessions" : "photo try-ons"}`;

type Row = { label: string; count: number; revenue: number; fees: number; photoAi: number; liveAi: number; otherAi: number; contribution: number };

function compute(a: CostAssumptions, usagePct: number) {
  const u = Math.max(0, usagePct) / 100;
  const perUser = (key: PlanKey) => {
    const p = a.plans[key];
    const photoAi = p.photos * u * a.photoCost;
    const liveAi = p.lives * u * a.liveCost;
    const otherAi = p.closetPhotos * a.claudePerClosetPhoto + p.styleIts * a.claudePerStyleIt + a.extraAiPerUser;
    const ai = photoAi + liveAi + otherAi;
    return { photoAi, liveAi, otherAi, ai, contribution: p.price - p.fee - ai };
  };
  const planRows: Record<PlanKey, Row & { perUser: ReturnType<typeof perUser> }> = {} as never;
  for (const key of PLAN_KEYS) {
    const p = a.plans[key];
    const n = a.users[key];
    const each = perUser(key);
    planRows[key] = {
      label: p.label,
      count: n,
      revenue: p.price * n,
      fees: p.fee * n,
      photoAi: each.photoAi * n,
      liveAi: each.liveAi * n,
      otherAi: each.otherAi * n,
      contribution: each.contribution * n,
      perUser: each,
    };
  }
  const packRows: Row[] = a.packs.map((p) => {
    const ai = p.credits * u * (p.kind === "live" ? a.liveCost : a.photoCost) * p.sold;
    return {
      label: packName(p),
      count: p.sold,
      revenue: p.price * p.sold,
      fees: p.fee * p.sold,
      photoAi: p.kind === "photo" ? ai : 0,
      liveAi: p.kind === "live" ? ai : 0,
      otherAi: 0,
      contribution: (p.price - p.fee) * p.sold - ai,
    };
  });
  const all = [...PLAN_KEYS.map((k) => planRows[k]), ...packRows];
  const sum = (f: (r: Row) => number) => all.reduce((t, r) => t + f(r), 0);

  const subscriptionRevenue = PAID.reduce((t, k) => t + planRows[k].revenue, 0) + planRows.free.revenue;
  const packRevenue = packRows.reduce((t, r) => t + r.revenue, 0);
  const revenue = subscriptionRevenue + packRevenue;
  const fees = sum((r) => r.fees);
  const photoAi = sum((r) => r.photoAi);
  const liveAi = sum((r) => r.liveAi);
  const otherAi = sum((r) => r.otherAi);
  const operating = a.hosting + a.other;
  const totalCosts = fees + photoAi + liveAi + otherAi + operating;
  const profit = revenue - totalCosts;
  const freeCost = planRows.free.photoAi + planRows.free.liveAi + planRows.free.otherAi;

  // With no other paid users: the fixed monthly bill (hosting, other, free users) over what each subscriber adds.
  const fixed = operating + freeCost;
  const breakEven = (key: PlanKey): number | null => {
    const c = planRows[key].perUser.contribution;
    if (fixed <= 0) return 0;
    return c > 0 ? Math.ceil(fixed / c) : null;
  };
  const profitAt = (key: PlanKey, n: number) => n * planRows[key].perUser.contribution - fixed;

  return {
    planRows,
    packRows,
    subscriptionRevenue,
    packRevenue,
    revenue,
    fees,
    photoAi,
    liveAi,
    otherAi,
    operating,
    totalCosts,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    freeCost,
    freePerUser: planRows.free.perUser.ai,
    breakEven: { plus: breakEven("plus"), pro: breakEven("pro") },
    profitAt,
  };
}

/** Saved edits laid over the defaults, so a value added to the defaults later is never missing (or NaN). */
function withDefaults(kept: Partial<CostAssumptions>, d: CostAssumptions): CostAssumptions {
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const pick = <T extends object>(saved: unknown, base: T): T => {
    const out = { ...base };
    for (const key of Object.keys(base) as (keyof T)[]) {
      const v = (saved as Record<keyof T, unknown> | undefined)?.[key];
      if (typeof base[key] === "number") out[key] = num(v, base[key] as number) as T[keyof T];
    }
    return out;
  };
  return {
    ...pick(kept, d),
    plans: { free: pick(kept.plans?.free, d.plans.free), plus: pick(kept.plans?.plus, d.plans.plus), pro: pick(kept.plans?.pro, d.plans.pro) },
    packs: d.packs.map((p) => pick(kept.packs?.find((k) => k?.id === p.id), p)),
    users: pick(kept.users, d.users),
    scenarios: d.scenarios.map((sc, i) => pick(kept.scenarios?.[i], sc)),
  };
}

/** A number box that lets people type freely ("0.", "") and reports clean numbers. */
function Num({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <label className="block min-w-0">
      <span className="block truncate text-[11px] font-semibold text-[#4f5b66]">{label}</span>
      <span className="mt-1 flex items-center rounded-[10px] bg-[#f4f5f6] px-3 focus-within:shadow-[inset_0_0_0_1px_#121821]">
        {prefix && <span className="text-[13px] text-[#5d6874]">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.max(0, n));
          }}
          onBlur={() => text === "" && (setText("0"), onChange(0))}
          className="w-full min-w-0 bg-transparent py-2 pl-1 text-[13.5px] tabular-nums text-[#121821] outline-none"
        />
        {suffix && <span className="text-[12px] text-[#5d6874]">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[10.5px] leading-snug text-[#8a5a14]">{hint}</span>}
    </label>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${surface} p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 text-[14px] font-semibold text-[#121821]">{title}</h2>
      {children}
    </section>
  );
}

/** Profit as subscribers grow (one line per plan), with the zero line marked. */
function ProfitChart({ points }: { points: { n: number; plus: number; pro: number }[] }) {
  const W = 560;
  const H = 220;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const values = points.flatMap((p) => [p.plus, p.pro, 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const maxN = points[points.length - 1].n || 1;
  const x = (n: number) => pad.l + (n / maxN) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const line = (k: "plus" | "pro") => points.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Estimated monthly profit by number of subscribers">
      {[max, (max + min) / 2, min].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(18,24,33,0.06)" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#5d6874">
            {money(v).replace(/\.\d\d$/, "")}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#121821" strokeOpacity="0.35" strokeDasharray="4 4" />
      <text x={W - pad.r} y={y(0) - 5} textAnchor="end" fontSize="10" fill="#5d6874">
        break-even
      </text>
      <path d={line("plus")} fill="none" stroke="#121821" strokeWidth="2" />
      <path d={line("pro")} fill="none" stroke="#2f8f97" strokeWidth="2" />
      {points.map((p) => (
        <text key={p.n} x={x(p.n)} y={H - 8} textAnchor="middle" fontSize="10" fill="#5d6874">
          {p.n}
        </text>
      ))}
    </svg>
  );
}

export function CostCalculator({ defaults }: { defaults: CostAssumptions }) {
  const [a, setA] = useState<CostAssumptions>(defaults);
  const [active, setActive] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Edits are remembered in this browser only.
  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Partial<CostAssumptions> | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
      if (kept) setA(withDefaults(kept, defaults));
    } catch {}
    setLoaded(true);
  }, [defaults]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(a));
    } catch {}
  }, [a, loaded]);

  const update = (change: (draft: CostAssumptions) => void) =>
    setA((prev) => {
      const next = structuredClone(prev);
      change(next);
      return next;
    });

  const results = useMemo(() => a.scenarios.map((s) => compute(a, s.usage)), [a]);
  const r = results[active];
  const scenario = a.scenarios[active];

  // Subscriber counts for the chart and table: up to about twice the larger break-even point.
  const counts = useMemo(() => {
    const be = Math.max(r.breakEven.plus ?? 0, r.breakEven.pro ?? 0);
    const top = Math.max(50, Math.ceil((be * 2) / 50) * 50);
    return Array.from({ length: 6 }, (_, i) => Math.round((top / 5) * i));
  }, [r.breakEven.plus, r.breakEven.pro]);

  const rows: (Row & { group?: string })[] = [
    ...PLAN_KEYS.map((k) => r.planRows[k]),
    ...r.packRows.map((p, i) => ({ ...p, group: i === 0 ? "Credit packs" : undefined })),
  ];
  const th = "px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[1px] text-[#5d6874]";
  const td = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      {/* Assumptions */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pb-2">
        <div className="flex items-center justify-between">
          <p className={eyebrow}>Assumptions</p>
          <button onClick={() => setA(structuredClone(defaults))} className="text-[12px] font-semibold text-[#4f5b66] underline-offset-4 hover:text-[#121821] hover:underline">
            Reset to defaults
          </button>
        </div>

        <Card title="Users this month">
          <div className="grid grid-cols-3 gap-3">
            {PLAN_KEYS.map((k) => (
              <Num key={k} label={a.plans[k].label} value={a.users[k]} onChange={(n) => update((d) => void (d.users[k] = Math.round(n)))} />
            ))}
          </div>
        </Card>

        <Card title="Plans">
          <div className="flex flex-col gap-4">
            {PLAN_KEYS.map((k) => (
              <div key={k}>
                <p className="mb-2 text-[12px] font-semibold text-[#121821]">{a.plans[k].label}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  <Num label="Price / mo" prefix="$" step={0.01} value={a.plans[k].price} onChange={(n) => update((d) => void (d.plans[k].price = n))} />
                  <Num label="Payment fee" prefix="$" step={0.01} value={a.plans[k].fee} onChange={(n) => update((d) => void (d.plans[k].fee = n))} />
                  <Num label="Photo try-ons" value={a.plans[k].photos} onChange={(n) => update((d) => void (d.plans[k].photos = Math.round(n)))} />
                  <Num label="Live sessions" value={a.plans[k].lives} onChange={(n) => update((d) => void (d.plans[k].lives = Math.round(n)))} />
                  <Num label="Clothing photos / user" value={a.plans[k].closetPhotos} onChange={(n) => update((d) => void (d.plans[k].closetPhotos = Math.round(n)))} />
                  <Num label="“Style it” / user" value={a.plans[k].styleIts} onChange={(n) => update((d) => void (d.plans[k].styleIts = Math.round(n)))} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Credit packs">
          <div className="flex flex-col gap-4">
            {a.packs.map((p, i) => (
              <div key={p.id}>
                <p className="mb-2 text-[12px] font-semibold text-[#121821]">{packName(p)}</p>
                <div className="grid grid-cols-3 gap-3">
                  <Num label="Price" prefix="$" step={0.01} value={p.price} onChange={(n) => update((d) => void (d.packs[i].price = n))} />
                  <Num label="Payment fee" prefix="$" step={0.01} value={p.fee} onChange={(n) => update((d) => void (d.packs[i].fee = n))} />
                  <Num label="Sold / mo" value={p.sold} onChange={(n) => update((d) => void (d.packs[i].sold = Math.round(n)))} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="AI costs (per completed try-on)">
          <div className="grid grid-cols-2 gap-3">
            <Num
              label="Photo try-on"
              prefix="$"
              step={0.01}
              value={a.photoCost}
              onChange={(n) => update((d) => void (d.photoCost = n))}
              hint="FLUX VTO v2 (BFL). BFL doesn't publish this price; check your BFL dashboard (1 credit = $0.01)."
            />
            <Num
              label="Live session"
              prefix="$"
              step={0.01}
              value={a.liveCost}
              onChange={(n) => update((d) => void (d.liveCost = n))}
              hint="Decart: about $0.02 a second, so $0.40 for a full 20-second session."
            />
          </div>
          <p className="mb-2 mt-4 text-[12px] font-semibold text-[#121821]">Claude (Sonnet 5)</p>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Per clothing photo" prefix="$" step={0.01} value={a.claudePerClosetPhoto} onChange={(n) => update((d) => void (d.claudePerClosetPhoto = n))} />
            <Num label="Per “Style it”" prefix="$" step={0.01} value={a.claudePerStyleIt} onChange={(n) => update((d) => void (d.claudePerStyleIt = n))} />
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-[#8a5a14]">
            $2 / $10 per million tokens in / out, estimated from the app&apos;s prompts. Your Claude Console usage page shows the real totals.
          </p>
          <div className="mt-3">
            <Num label="Other AI cost per user / mo" prefix="$" step={0.01} value={a.extraAiPerUser} onChange={(n) => update((d) => void (d.extraAiPerUser = n))} />
          </div>
        </Card>

        <Card title="Monthly running costs">
          <div className="grid grid-cols-2 gap-3">
            <Num label="Hosting & Cloudflare" prefix="$" step={1} value={a.hosting} onChange={(n) => update((d) => void (d.hosting = n))} />
            <Num label="Other expenses" prefix="$" step={1} value={a.other} onChange={(n) => update((d) => void (d.other = n))} />
          </div>
        </Card>
      </div>

      {/* Results */}
      <div className="flex min-w-0 flex-col gap-6">
        <p className="rounded-[14px] bg-[#eef1f2] px-4 py-3 text-[13px] text-[#3b4850]">
          All results are estimates for one month, not guaranteed profits. Real costs depend on what people actually use and on provider prices.
        </p>

        {/* Scenarios: pick one to see its detail below; usage is editable. */}
        <div className="grid gap-3 sm:grid-cols-3">
          {a.scenarios.map((s, i) => {
            const res = results[i];
            const on = i === active;
            return (
              <div
                key={s.name}
                role="button"
                tabIndex={0}
                onClick={() => setActive(i)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(i)}
                className={`${surface} cursor-pointer p-4 text-left transition ${on ? "ring-[1.5px] ring-[#121821]" : "hover:-translate-y-0.5"}`}
              >
                <p className="text-[12px] font-semibold text-[#121821]">{s.name}</p>
                <div className="mt-2 w-24" onClick={(e) => e.stopPropagation()}>
                  <Num label="Usage" suffix="%" value={s.usage} onChange={(n) => update((d) => void (d.scenarios[i].usage = n))} />
                </div>
                <p className={`mt-3 font-display text-[28px] leading-none ${res.profit < 0 ? "text-[#a3261b]" : "text-[#121821]"}`}>{money(res.profit)}</p>
                <p className="mt-1 text-[11px] text-[#5d6874]">profit · margin {pctText(res.margin)}</p>
              </div>
            );
          })}
        </div>

        {/* Headline numbers for the chosen scenario */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Revenue", money(r.revenue)],
            ["Total costs", money(r.totalCosts)],
            [r.profit < 0 ? "Loss" : "Profit", money(r.profit)],
            ["Margin", pctText(r.margin)],
          ].map(([label, value]) => (
            <div key={label} className={`${surface} px-4 py-4`}>
              <p className="text-[11px] font-semibold text-[#4f5b66]">
                {label} <span className="font-normal text-[#5d6874]">· est.</span>
              </p>
              <p className={`mt-1 font-display text-[30px] leading-none ${label === "Loss" ? "text-[#a3261b]" : "text-[#121821]"}`}>{value}</p>
            </div>
          ))}
        </div>

        <Card title={`Breakdown · ${scenario.name} (${scenario.usage}% of allowances used)`}>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px] text-[#26313a]">
              <thead>
                <tr className="border-b border-black/[0.07]">
                  <th className={`${th} text-left`}> </th>
                  <th className={th}>Users / sold</th>
                  <th className={th}>Revenue</th>
                  <th className={th}>Payment fees</th>
                  <th className={th}>Photo AI</th>
                  <th className={th}>Live AI</th>
                  <th className={th}>Claude & other AI</th>
                  <th className={th}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.label}>
                    {row.group && (
                      <tr>
                        <td colSpan={8} className="px-3 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[1px] text-[#5d6874]">
                          {row.group}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-black/[0.05]">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[#121821]">{row.label}</td>
                      <td className={td}>{row.count.toLocaleString()}</td>
                      <td className={td}>{money(row.revenue)}</td>
                      <td className={td}>{money(-row.fees)}</td>
                      <td className={td}>{money(-row.photoAi)}</td>
                      <td className={td}>{money(-row.liveAi)}</td>
                      <td className={td}>{money(-row.otherAi)}</td>
                      <td className={`${td} font-semibold ${row.contribution < 0 ? "text-[#a3261b]" : "text-[#121821]"}`}>{money(row.contribution)}</td>
                    </tr>
                  </Fragment>
                ))}
                <tr className="border-b border-black/[0.05]">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[#121821]">Hosting & other expenses</td>
                  <td className={td} colSpan={6} />
                  <td className={`${td} font-semibold`}>{money(-r.operating)}</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#121821]">Estimated {r.profit < 0 ? "loss" : "profit"}</td>
                  <td className={td} colSpan={6} />
                  <td className={`${td} text-[15px] font-semibold ${r.profit < 0 ? "text-[#a3261b]" : "text-[#121821]"}`}>{money(r.profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-[#5d6874]">
            Per subscriber each month: Plus adds {money(r.planRows.plus.perUser.contribution)}, Pro adds {money(r.planRows.pro.perUser.contribution)}, each
            Free user costs {money(r.freePerUser)} (after payment fees and AI costs).
          </p>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Monthly summary">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13px]">
              {(
                [
                  ["Subscription revenue", r.subscriptionRevenue],
                  ["Credit pack revenue", r.packRevenue],
                  ["Payment processing fees", -r.fees],
                  ["Photo try-on costs", -r.photoAi],
                  ["Live try-on costs", -r.liveAi],
                  ["Claude & other AI costs", -r.otherAi],
                  ["Hosting & Cloudflare", -a.hosting],
                  ["Other expenses", -a.other],
                  ["Total costs", -r.totalCosts],
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className={k === "Total costs" ? "border-t border-black/[0.07] pt-2 font-semibold text-[#121821]" : "text-[#4f5b66]"}>{k}</dt>
                  <dd className={`text-right tabular-nums ${k === "Total costs" ? "border-t border-black/[0.07] pt-2 font-semibold" : ""} text-[#121821]`}>{money(v)}</dd>
                </div>
              ))}
              <dt className="font-semibold text-[#121821]">Estimated {r.profit < 0 ? "loss" : "profit"}</dt>
              <dd className={`text-right font-semibold tabular-nums ${r.profit < 0 ? "text-[#a3261b]" : "text-[#121821]"}`}>{money(r.profit)}</dd>
              <dt className="text-[#4f5b66]">Profit margin</dt>
              <dd className="text-right tabular-nums text-[#121821]">{pctText(r.margin)}</dd>
            </dl>
          </Card>

          <Card title="Break-even (starting from no paid users)">
            <div className="grid grid-cols-2 gap-3">
              {PAID.map((k) => (
                <div key={k} className="rounded-[14px] bg-[#f4f5f6] px-4 py-3">
                  <p className="text-[11px] font-semibold text-[#4f5b66]">{a.plans[k].label} subscribers needed</p>
                  <p className="mt-1 font-display text-[30px] leading-none text-[#121821]">{r.breakEven[k] ?? "—"}</p>
                  {r.breakEven[k] === null && <p className="mt-1 text-[11px] text-[#a3261b]">Loses money per subscriber at this usage.</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-snug text-[#5d6874]">
              Covers hosting, other expenses and your {a.users.free.toLocaleString()} Free users ({money(r.freeCost)} a month in AI costs), with only
              that one plan and no credit packs.
            </p>
          </Card>
        </div>

        <Card title="Estimated profit by number of subscribers">
          <div className="mb-2 flex gap-4 text-[12px] text-[#4f5b66]">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#121821]" /> Only Plus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#2f8f97]" /> Only Pro
            </span>
          </div>
          <ProfitChart points={counts.map((n) => ({ n, plus: r.profitAt("plus", n), pro: r.profitAt("pro", n) }))} />
          <div className="-mx-2 mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[13px] text-[#26313a]">
              <thead>
                <tr className="border-b border-black/[0.07]">
                  <th className={`${th} text-left`}>Subscribers</th>
                  <th className={th}>Only Plus</th>
                  <th className={th}>Only Pro</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((n) => (
                  <tr key={n} className="border-b border-black/[0.05]">
                    <td className="px-3 py-2 tabular-nums">{n}</td>
                    {PAID.map((k) => {
                      const v = r.profitAt(k, n);
                      return (
                        <td key={k} className={`${td} ${v < 0 ? "text-[#a3261b]" : "text-[#121821]"}`}>
                          {money(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-[#5d6874]">With your current Free users, hosting and other expenses; no credit packs.</p>
        </Card>

        <details className={`${surface} p-5 text-[13px] text-[#26313a] sm:p-6`}>
          <summary className="cursor-pointer text-[14px] font-semibold text-[#121821]">How it&apos;s worked out</summary>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
            <li>Claude per user = clothing photos added × Claude per photo + “Style it” requests × Claude per request (not scaled by usage).</li>
            <li>AI cost per user = photo try-ons × usage × photo cost + live sessions × usage × live cost + Claude per user + other AI per user.</li>
            <li>Contribution per subscriber = price − payment fee − AI cost per user.</li>
            <li>Credit pack contribution = (price − fee) × packs sold − credits × usage × cost per try-on × packs sold.</li>
            <li>Free users&apos; cost = Free users × AI cost per Free user.</li>
            <li>Profit = all revenue − payment fees − AI costs − hosting − other expenses. Margin = profit ÷ revenue.</li>
            <li>Break-even subscribers = (hosting + other expenses + Free users&apos; cost) ÷ contribution per subscriber, rounded up.</li>
            <li>Usage is the share of each allowance people actually use; the same share is applied to credit packs.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
