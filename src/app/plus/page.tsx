"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { refreshCredits } from "@/components/Credits";
import { PLAN_ALLOWANCES } from "@/lib/plans";
import { PageShell, btnPrimary, btnSecondary, eyebrow, surface } from "@/components/ui";

const PLUS = PLAN_ALLOWANCES.plus;
const INCLUDES = [
  `${PLUS.photo} photo try-ons`,
  `${PLUS.live} live try-ons`,
  `${PLUS.closet} clothing photo additions with AI tagging`,
  `${PLUS.style} Style It searches`,
];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** Continue with Plus: what it includes each month, a final confirmation, then Stripe's payment page. */
function Plus() {
  const params = useSearchParams();
  const done = params.get("done") === "1";
  const canceled = params.get("canceled") === "1";
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitedOut, setWaitedOut] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/status", { cache: "no-store" }).catch(() => null);
    const next = res?.ok ? ((await res.json()) as BillingStatus) : null;
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const first = await load();
      // Back from Stripe: Plus starts when Stripe confirms the payment (a few seconds), so check until it has.
      if (!done || first?.subscribed) return;
      for (let i = 0; i < 15 && !stop; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const next = await load();
        if (next?.subscribed) {
          refreshCredits();
          return;
        }
      }
      if (!stop) setWaitedOut(true);
    })();
    return () => {
      stop = true;
    };
  }, [done, load]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      void load();
    } catch {
      setError("Couldn't reach Virm. Check your connection and try again.");
    }
    setBusy(false);
  }

  let body: React.ReactNode;
  if (!status) {
    body = <p className="text-[14px] text-[#5d6874]">Loading…</p>;
  } else if (!status.enabled) {
    body = <p className="text-[14px] text-[#4f5b66]">Plus isn&apos;t open yet.</p>;
  } else if (status.subscribed) {
    body = (
      <>
        <p className="text-[18px] font-semibold text-[#121821]">You&apos;re on Plus.</p>
        {status.endsAt && <p className="mt-1 text-[14px] text-[#4f5b66]">It ends {day(status.endsAt)}.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/studio" className={btnPrimary}>
            Open the Studio
          </Link>
          <Link href="/profile" className={btnSecondary}>
            See what&apos;s left
          </Link>
        </div>
      </>
    );
  } else if (done && !waitedOut) {
    body = <p className="text-[14px] text-[#4f5b66]">Payment received. Starting Plus…</p>;
  } else {
    const trial = status.trial;
    body = (
      <>
        {done && waitedOut && <p className="mb-4 text-[13px] text-[#8a4b12]">This is taking longer than usual. Refresh in a minute.</p>}
        {canceled && <p className="mb-4 text-[13px] text-[#5d6874]">Nothing was charged.</p>}
        {trial && (
          <p className="mb-4 text-[13px] text-[#5d6874]">
            {trial.active ? `Your trial ends ${day(trial.endsAt)}. Your trial credits stay until then.` : "Your trial has ended."}
          </p>
        )}
        <p className="text-[28px] font-semibold tracking-[-0.5px] text-[#121821]">
          $14.99<span className="text-[15px] font-normal text-[#5d6874]"> / month</span>
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#4f5b66]">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#121821]" />
          <span>
            I want VIRM Plus. I&apos;ll be charged $14.99 today and every month until I cancel, and I can cancel anytime. See the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>
            .
          </span>
        </label>
        {status.signedIn ? (
          <button onClick={subscribe} disabled={!confirmed || busy} className={`${btnPrimary} mt-5 w-full sm:w-auto`}>
            {busy ? "Opening…" : "Continue to payment"}
          </button>
        ) : (
          <Link href="/login" className={`${btnPrimary} mt-5 w-full sm:w-auto`}>
            Sign in to continue
          </Link>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section>
        <p className={eyebrow}>VIRM Plus</p>
        <h1 className="mt-3 font-display text-[40px] font-normal leading-[1] tracking-[-1.2px] text-[#121821] sm:text-[56px]">
          Keep VIRM Plus.
        </h1>
        <p className="mt-6 text-[14px] font-semibold text-[#121821]">Every month:</p>
        <ul className="mt-2 grid gap-1.5 text-[14px] text-[#121821]">
          {INCLUDES.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden>·</span>
              {line}
            </li>
          ))}
        </ul>
      </section>
      <section className={`${surface} p-5 sm:p-6`} aria-live="polite">
        {body}
      </section>
    </div>
  );
}

export default function PlusPage() {
  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-10 sm:pt-14">
        <Suspense fallback={null}>
          <Plus />
        </Suspense>
      </PageShell>
    </main>
  );
}
