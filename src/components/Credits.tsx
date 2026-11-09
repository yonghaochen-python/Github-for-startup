"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Balances, KindBalance } from "@/lib/credits";
import { PLAN_NAMES } from "@/lib/plans";
import { eyebrow } from "@/components/ui";

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

/** Profile: plan, when the monthly allowance resets, and photo/live balances. */
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
          <div className="mt-2">
            <Row label="Photo credits" b={b.photo} />
            {b.photoUsed && b.photoUsed.tryOns + b.photoUsed.reports > 0 && (
              <p className="-mt-1.5 pb-2 text-right text-[11.5px] text-[#5d6874]">
                Used: {b.photoUsed.tryOns} {b.photoUsed.tryOns === 1 ? "try-on" : "try-ons"} · {b.photoUsed.reports}{" "}
                {b.photoUsed.reports === 1 ? "report" : "reports"}
              </p>
            )}
            <Row label="Live sessions" b={b.live} />
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">
            The monthly allowance resets each period; extra credits don&apos;t expire.
            {b.exempt ? " Admin account: not limited." : b.enforcement === "count" ? " Photo limits aren't applied yet." : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** Studio: one quiet line under Try On. */
export function CreditsLine({ kind }: { kind: "photo" | "live" }) {
  const b = useCredits();
  if (!b) return null;
  const k = b[kind];
  const noun = kind === "photo" ? "photo try-ons" : "live sessions";
  return (
    <p className="mt-2 text-center text-[11.5px] text-[#5d6874]">
      {b.exempt
        ? `Admin · not limited (${k.planUsed + k.overLimit} ${noun} used this month)`
        : k.total > 0
          ? `${k.total} ${noun} left${k.extraLeft ? ` (${k.planLeft} this month + ${k.extraLeft} extra)` : ""} · resets ${day(b.period.end)}`
          : `This month's ${noun} are used up · resets ${day(b.period.end)}${b.enforcement === "count" ? " (not applied yet)" : ""}`}
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
