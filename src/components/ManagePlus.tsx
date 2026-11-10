"use client";

import { useEffect, useState } from "react";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { btnSecondary } from "@/components/ui";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** Profile, for Plus members: Stripe's own page to change the card, see invoices or cancel. */
export function ManagePlus() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as BillingStatus) : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status?.enabled || !status.subscribed) return null;

  async function open() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { url?: string; error?: string }) : {};
    if (res?.ok && data.url) return window.location.assign(data.url);
    setError(data.error ?? "Couldn't reach Virm. Please try again.");
    setBusy(false);
  }

  return (
    <div className="mt-3">
      {status.pastDue && <p className="mb-2 text-[13px] text-[#a1312a]">Your last payment didn&apos;t go through. Update your card to keep Plus.</p>}
      {status.endsAt && <p className="mb-2 text-[13px] text-[#4f5b66]">Plus ends {day(status.endsAt)}. No more charges.</p>}
      <button onClick={open} disabled={busy} className={btnSecondary}>
        {busy ? "Opening…" : status.pastDue ? "Update card" : "Manage Plus"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[#a1312a]">
          {error}
        </p>
      )}
    </div>
  );
}
