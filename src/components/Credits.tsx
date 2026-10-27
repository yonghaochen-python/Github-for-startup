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
            <Row label="Photo try-ons" b={b.photo} />
            <Row label="Live sessions" b={b.live} />
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">
            The monthly allowance resets each period; extra credits don&apos;t expire.
            {b.exempt ? " Admin account: not limited." : b.enforcement === "count" ? " Limits aren't applied yet." : ""}
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
