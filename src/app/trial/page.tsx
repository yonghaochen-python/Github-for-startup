"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { refreshCredits } from "@/components/Credits";
import { PageShell, btnPrimary, btnSecondary, eyebrow, surface } from "@/components/ui";
import { TRIAL_ALLOWANCES, TRIAL_DAYS, type TrialKind } from "@/lib/plans";
import { clearPendingInvite, pendingInvite, redeemInvite } from "@/lib/pendingInvite";

const includes = (a: Record<TrialKind, number>) => [
  `${a.photo} photo try-ons`,
  `${a.live} live try-ons`,
  `${a.report} AI Stylist reports`,
  `${a.closet} clothing photo additions with AI tagging`,
  `${a.style} Style It searches`,
];
const WORDS: Record<number, string> = { 7: "seven", 14: "fourteen" };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/**
 * The Plus trial (7 days, or 14 with a friend's code): what it includes, then a card saved on Stripe's page with $0
 * charged. A friend's code can be entered here until the trial starts.
 */
function Trial() {
  const params = useSearchParams();
  const done = params.get("done") === "1";
  const canceled = params.get("canceled") === "1";
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitedOut, setWaitedOut] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

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
      // Back from Stripe: the trial starts when Stripe confirms the card (a few seconds), so check again until it has.
      if (!done || first?.trial) return;
      for (let i = 0; i < 15 && !stop; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const next = await load();
        if (next?.trial) {
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

  // A code from a friend's /join link: used automatically for a signed-in account that can still take it.
  useEffect(() => {
    const saved = pendingInvite();
    if (!saved || !status?.enabled || !status.signedIn || status.invited || status.trial) return;
    void redeemInvite(saved).then((err) => {
      clearPendingInvite();
      if (err) setCodeError(err);
      void load();
    });
  }, [status, load]);

  async function applyCode() {
    setCodeError(null);
    const err = await redeemInvite(code);
    if (err) return setCodeError(err);
    setCodeOpen(false);
    void load();
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
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

  const days = status?.trialDays ?? TRIAL_DAYS;
  const allowances = status?.trialAllowances ?? TRIAL_ALLOWANCES;

  let body: React.ReactNode;
  if (!status) {
    body = <p className="text-[14px] text-[#5d6874]">Loading…</p>;
  } else if (!status.enabled) {
    body = <p className="text-[14px] text-[#4f5b66]">The free trial isn&apos;t open yet.</p>;
  } else if (status.trial?.active) {
    body = (
      <>
        <p className="text-[18px] font-semibold text-[#121821]">Your Plus trial is on.</p>
        <p className="mt-1 text-[14px] text-[#4f5b66]">It ends {day(status.trial.endsAt)}. No automatic charge.</p>
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
  } else if (status.subscribed) {
    body = <p className="text-[14px] text-[#4f5b66]">You&apos;re already on Plus.</p>;
  } else if (status.hadPlus) {
    body = (
      <>
        <p className="text-[14px] text-[#4f5b66]">The free trial is for before your first Plus month.</p>
        <Link href="/plus" className={`${btnPrimary} mt-5`}>
          Get Plus
        </Link>
      </>
    );
  } else if (status.trial) {
    body = <p className="text-[14px] text-[#4f5b66]">You&apos;ve already had your free trial.</p>;
  } else if (done && !waitedOut) {
    body = <p className="text-[14px] text-[#4f5b66]">Card saved. Starting your trial…</p>;
  } else {
    body = (
      <>
        {done && waitedOut && <p className="mb-4 text-[13px] text-[#8a4b12]">This is taking longer than usual. Refresh in a minute.</p>}
        {canceled && <p className="mb-4 text-[13px] text-[#5d6874]">No card saved. You can start whenever you like.</p>}
        <ul className="grid gap-1.5 text-[13.5px] text-[#121821]">
          <li>✓ Full Plus access during the trial</li>
          <li>✓ $0 charged today</li>
          <li>✓ No automatic charge when the trial ends</li>
          <li className="text-[#4f5b66]">A card is needed to start (saved securely by Stripe).</li>
        </ul>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#4f5b66]">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#121821]" />
          <span>
            I understand my card is saved but not charged, and that after {WORDS[days] ?? days} days I can choose whether to continue with Plus for $14.99/month. See the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>
            .
          </span>
        </label>
        {status.signedIn && !status.invited && (
          <div className="mt-4 text-[13px]">
            {codeOpen ? (
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VIRM-K7Q2X"
                  aria-label="Friend's code"
                  autoCapitalize="characters"
                  className="min-h-[42px] min-w-0 flex-1 rounded-full bg-white px-4 uppercase shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#121821]"
                />
                <button onClick={applyCode} disabled={!code.trim()} className={btnSecondary}>
                  Apply
                </button>
              </div>
            ) : (
              <button onClick={() => setCodeOpen(true)} className="font-medium text-[#121821] underline-offset-4 hover:underline">
                Have a friend&apos;s code? Get 14 days
              </button>
            )}
            {codeError && (
              <p role="alert" className="mt-2 text-[#a1312a]">
                {codeError}
              </p>
            )}
          </div>
        )}
        {status.invited && <p className="mt-4 text-[13px] font-medium text-[#1d6b3a]">✓ Friend&apos;s code applied: your trial is 14 days.</p>}
        {status.signedIn ? (
          <button onClick={start} disabled={!accepted || busy} className={`${btnPrimary} mt-5 w-full sm:w-auto`}>
            {busy ? "Opening…" : "Start my free trial"}
          </button>
        ) : (
          <Link href="/login" className={`${btnPrimary} mt-5 w-full sm:w-auto`}>
            Sign in to start
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
          Try VIRM Plus free for {days} days.
        </h1>
        <p className="mt-6 text-[14px] font-semibold text-[#121821]">Your {days}-day Plus trial includes:</p>
        <ul className="mt-2 grid gap-1.5 text-[14px] text-[#121821]">
          {includes(allowances).map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden>·</span>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#4f5b66]">
          Enjoy {WORDS[days] ?? days} days of VIRM Plus, with clear usage limits and no automatic payment when your trial ends.
        </p>
      </section>
      <section className={`${surface} p-5 sm:p-6`} aria-live="polite">
        {body}
      </section>
    </div>
  );
}

export default function TrialPage() {
  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-10 sm:pt-14">
        <Suspense fallback={null}>
          <Trial />
        </Suspense>
      </PageShell>
    </main>
  );
}
