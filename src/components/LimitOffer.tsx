"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { useToast } from "@/components/Toast";

/** What to offer someone who just reached a limit: the free trial if they can still have it, otherwise Plus. */
function offerFor(s: BillingStatus): { text: string; label: string; href: string } | null {
  if (!s.enabled || !s.signedIn || s.subscribed) return null;
  if (!s.trial && !s.hadPlus) return { text: "Want more?", label: `Try Plus free for ${s.trialDays} days`, href: "/trial" };
  return { text: "Want more every month?", label: "Get Plus", href: "/plus" };
}

/**
 * When Virm refuses something because a limit was reached (any screen: try-on, live, clothing photos, Style It,
 * AI Stylist), a note with one button appears under the screen's own message: the free trial, or Plus once the trial
 * is used. Nothing changes for Plus members or while billing is off.
 */
export function LimitOffer() {
  const { showToast } = useToast();
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 402) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
        const ownApi = url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);
        // At most one offer a minute, so several refusals in a row don't stack up.
        if (ownApi && Date.now() - last.current > 60_000) {
          void res
            .clone()
            .json()
            .then(async (body: unknown) => {
              if ((body as { code?: string } | null)?.code !== "no_credits") return;
              const status = (await (await original("/api/billing/status", { cache: "no-store" })).json()) as BillingStatus;
              const offer = offerFor(status);
              if (!offer) return;
              last.current = Date.now();
              showToast(offer.text, { label: offer.label, onClick: () => router.push(offer.href) }, { check: false });
            })
            .catch(() => {});
        }
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [showToast, router]);

  return null;
}
