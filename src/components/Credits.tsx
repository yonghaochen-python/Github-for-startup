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

/** Home: what uses a credit, in one line each, with what's left. */
export function CreditGuide() {
  const b = useCredits();
  const items = [
    { label: "AI Stylist analysis", cost: "1 photo credit" },
    { label: "Outfit try-on", cost: "1 photo credit" },
    { label: "Live try-on", cost: "1 live credit" },
  ];
  return (
    <section aria-label="What uses a credit" className="mb-6 flex flex-col gap-3 rounded-[18px] bg-white px-5 py-4 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] sm:flex-row sm:items-center sm:gap-6">
      <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        {items.map((i) => (
          <li key={i.label} className="text-[13px] text-[#4f5b66]">
            <span className="font-semibold text-[#121821]">{i.label}</span> · {i.cost}
          </li>
        ))}
      </ul>
      {b && (
        <p className="shrink-0 text-[12.5px] text-[#5d6874]">
          {b.exempt ? (
            "Admin · not limited"
          ) : (
            <>
              <b className="font-semibold text-[#121821]">{b.photo.total}</b> photo · <b className="font-semibold text-[#121821]">{b.live.total}</b> live left · resets {day(b.period.end)}
            </>
          )}
        </p>
      )}
    </section>
  );
}
