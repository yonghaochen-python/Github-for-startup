"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Balances, KindBalance } from "@/lib/credits";
import { KIND_NAMES, PLAN_NAMES, TRIAL_KINDS, type CreditKind } from "@/lib/plans";
import { eyebrow } from "@/components/ui";
import { ManagePlus } from "@/components/ManagePlus";

/** Ask open balances to reload (after a try-on, for example). */
export const refreshCredits = () => window.dispatchEvent(new Event("virm-credits"));

/** The signed-in person's balances, straight from the server (the same numbers it checks against). */
export function useCredits(): Balances | null {
  const [balances, setBalances] = useState<Balances | null>(null);
  const load = useCallback(() => {
    fetch("/api/me/credits", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { balances: Balances }).balances : null))
      .then(setBalances)
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("virm-credits", load);
    return () => window.removeEventListener("virm-credits", load);
  }, [load]);
  return balances;
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Row({ label, b }: { label: string; b: KindBalance }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-black/[0.06] py-2.5 text-[13px]">
      <span className="text-[#4f5b66]">{label}</span>
      <span className="text-right text-[#121821]">
        <b className="font-semibold">{b.total}</b> left
        <span className="ml-2 text-[11.5px] text-[#5d6874]">
          {b.planLeft} of {b.allowance} this month · {b.extraLeft} extra
        </span>
      </span>
    </div>
  );
}

/** Days left until a date (at least 1 while it hasn't passed). */
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** The running 7-day trial: when it ends, and each trial allowance with what's left. */
function TrialPanel({ b }: { b: Balances }) {
  if (!b.trial) return null;
  const t = b.trial;
  const n = daysLeft(t.endsAt);
  return (
    <div className="mt-3 rounded-[12px] bg-[#f6f5f2] p-3">
      <p className="text-[13px] font-semibold text-[#121821]">
        Plus trial · {n} {n === 1 ? "day" : "days"} left
        <span className="ml-1 font-normal text-[#5d6874]">(ends {day(t.endsAt)})</span>
      </p>
      <ul className="mt-1.5 grid gap-1 text-[12px] text-[#4f5b66]">
        {TRIAL_KINDS.map((kind) => (
          <li key={kind} className="flex justify-between gap-3">
            <span className="first-letter:uppercase">{KIND_NAMES[kind]}</span>
            <span className="tabular-nums text-[#121821]">
              {t.left[kind] > 0 ? `${t.left[kind]} of ${t.allowance[kind]} left` : "Used up · your Free allowance applies"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] text-[#5d6874]">No automatic charge when it ends.</p>
    </div>
  );
}

/** Profile: plan, when the monthly allowances reset, every allowance, and the trial while it runs. */
export function CreditsCard() {
  const b = useCredits();
  return (
    <div className="mt-6">
      <p className={eyebrow}>Plan & credits</p>
      {!b ? (
        <div className="mt-2 h-24 animate-pulse rounded-[12px] bg-[#f4f5f6]" />
      ) : (
        <>
          <p className="mt-1.5 text-[15px] text-[#121821]">
            {PLAN_NAMES[b.plan]} · resets {day(b.period.end)}{" "}
            <Link href="/pricing" className="ml-1 text-[13px] font-semibold underline-offset-4 hover:underline">
              See plans
            </Link>
          </p>
          <ManagePlus />
          <TrialPanel b={b} />
          <div className="mt-2">
            <Row label="Photo credits" b={b.photo} />
            {b.photoUsed && b.photoUsed.tryOns + b.photoUsed.reports > 0 && (
              <p className="-mt-1.5 pb-2 text-right text-[11.5px] text-[#5d6874]">
                Used: {b.photoUsed.tryOns} {b.photoUsed.tryOns === 1 ? "try-on" : "try-ons"} · {b.photoUsed.reports}{" "}
                {b.photoUsed.reports === 1 ? "report" : "reports"}
              </p>
            )}
            <Row label="Live sessions" b={b.live} />
            <Row label="Clothing photos" b={b.closet} />
            <Row label="Style It searches" b={b.style} />
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">
            Monthly allowances reset {day(b.period.end)}; extra credits don&apos;t expire. Reopening anything you already made is free.
            {b.exempt ? " Admin account: not limited." : b.enforcement === "count" ? " Limits aren't applied yet." : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** Studio, AI Stylist: one quiet line under the button that uses credits (the trial's first while it runs). */
export function CreditsLine({ kind, report }: { kind: CreditKind; report?: string }) {
  const b = useCredits();
  if (!b) return null;
  const k = b[kind];
  const noun = KIND_NAMES[kind];
  // An AI Stylist report: the trial covers one of each type; one it already covered uses a photo credit.
  const tk = report ? "report" : kind;
  const coveredBefore = Boolean(report && b.trial?.reports.includes(report));
  const trialLeft = b.trial && !b.exempt ? (coveredBefore ? 0 : b.trial.left[tk]) : null;
  return (
    <p className="mt-2 text-center text-[11.5px] text-[#5d6874]">
      {b.exempt
        ? `Admin · not limited (${k.planUsed + k.overLimit} ${noun} used this month)`
        : trialLeft !== null && trialLeft > 0
          ? `${trialLeft} trial ${KIND_NAMES[tk]} left · trial ends ${day(b.trial!.endsAt)}`
          : `${trialLeft === 0 ? (coveredBefore ? "Your trial already covered this report · this one uses a photo credit · " : `Trial ${KIND_NAMES[tk]} used up · `) : ""}${
              k.total > 0
                ? `${k.total} ${noun} left${k.extraLeft ? ` (${k.planLeft} this month + ${k.extraLeft} extra)` : ""} · resets ${day(b.period.end)}`
                : `This month's ${noun} are used up · resets ${day(b.period.end)}${b.enforcement === "count" ? " (not applied yet)" : ""}`
            }`}
    </p>
  );
}

/** One kind of credit on Home: how many are left, a bar, and what uses it. */
function CreditKindCard({ title, b, exempt, usedBy }: { title: string; b: KindBalance; exempt: boolean; usedBy: string }) {
  const share = b.allowance ? Math.min(1, b.planLeft / b.allowance) : 0;
  return (
    <div className="rounded-[16px] bg-[#f6f7f8] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-[#121821]">{title}</p>
        <p className="text-[#121821]">
          {exempt ? (
            <span className="text-[12px] text-[#5d6874]">Not limited</span>
          ) : (
            <>
              <span className="font-display text-[30px] leading-none">{b.total}</span>
              <span className="text-[12px] text-[#5d6874]"> left</span>
            </>
          )}
        </p>
      </div>
      {!exempt && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e3e7eb]" aria-hidden>
          <div className="h-full rounded-full bg-[#121821]" style={{ width: `${share * 100}%` }} />
        </div>
      )}
      <p className="mt-2 text-[12px] text-[#5d6874]">{usedBy}</p>
    </div>
  );
}

/** Home: how many of each credit are left, and what uses each (one credit per use). */
export function CreditGuide() {
  const b = useCredits();
  if (!b) return null;
  return (
    <section aria-labelledby="credits-home" className="mb-6 rounded-[22px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="credits-home" className="font-display text-[24px] leading-none text-[#121821]">
          Your credits
        </h2>
        <p className="text-[12px] text-[#5d6874]">Resets {day(b.period.end)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CreditKindCard title="Photo" b={b.photo} exempt={b.exempt} usedBy="1 per AI Stylist analysis or photo try-on" />
        <CreditKindCard title="Live" b={b.live} exempt={b.exempt} usedBy="1 per live try-on" />
      </div>
    </section>
  );
}
