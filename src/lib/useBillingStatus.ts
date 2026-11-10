"use client";

import { useEffect, useState } from "react";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { useAuth } from "@/components/AuthProvider";

/** One request per page view, shared by every part of the page that asks (menu, banner, pricing, profile). */
let cached: { key: string; promise: Promise<BillingStatus | null> } | null = null;

function load(key: string): Promise<BillingStatus | null> {
  if (cached?.key !== key) {
    const promise = fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as BillingStatus) : null))
      .catch(() => null);
    cached = { key, promise };
  }
  return cached.promise;
}

/** The signed-in person's trial and Plus status (null while loading). Reloads when the page or account changes. */
export function useBillingStatus(): BillingStatus | null {
  const { status: auth, user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  useEffect(() => {
    if (auth === "loading") return;
    let gone = false;
    // A new page load (or account) asks again; the same page shares one answer.
    void load(`${user?.id ?? "signed-out"}-${typeof window === "undefined" ? "" : window.location.pathname}`).then((s) => {
      if (!gone) setStatus(s);
    });
    return () => {
      gone = true;
    };
  }, [auth, user?.id]);
  return status;
}
