"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BillingStatus } from "@/app/api/billing/status/route";
import { useBillingStatus } from "@/lib/useBillingStatus";
import { useAuth } from "@/components/AuthProvider";

/** How long after the trial ends the "continue with Plus" offer still shows. */
const OFFER_DAYS = 14;
const DAY = 86_400_000;

/** "today", "tomorrow" or the weekday, by the person's own calendar. */
function day(iso: string): string {
  const d = new Date(iso);
  const dayNumber = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60_000) / DAY);
  const diff = dayNumber(d) - dayNumber(new Date());
  return diff <= 0 ? "today" : diff === 1 ? "tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
}

type Note = { key: string; text: string; action: string; href?: string };

/**
 * What to say, if anything: a failed Plus payment; the trial's last two days (days 6 and 7); then the offer for 14 days
 * after the trial ends.
 */
function noteFor(s: BillingStatus): Note | null {
  if (!s.enabled) return null;
  if (s.pastDue) return { key: "past-due", text: "Payment failed", action: "Update card", href: "/profile" };
  // Joined with a friend's code but hasn't started the trial yet.
  if (s.invited && !s.trial && !s.subscribed && !s.hadPlus) return { key: "invited", text: `${s.trialDays} days of Plus, free`, action: "Start", href: "/trial" };
  if (s.subscribed || !s.trial) return null;
  const ends = new Date(s.trial.endsAt).getTime();
  const left = ends - Date.now();
  if (left > 0 && left <= 2 * DAY) {
    return { key: `ending-${s.trial.endsAt}`, text: `Trial ends ${day(s.trial.endsAt)}`, action: "Keep Plus" };
  }
  if (left <= 0 && -left <= OFFER_DAYS * DAY) {
    return { key: `ended-${s.trial.endsAt}`, text: "Your trial has ended", action: "Get Plus" };
  }
  return null;
}

const DISMISSED = "virm-trial-note-dismissed";

/** A slim note under the menu near the end of the trial and after it. One ✕ hides it (until the next stage). */
export function TrialBanner() {
  const { status: auth } = useAuth();
  const pathname = usePathname();
  const billing = useBillingStatus();
  // Read once in the browser (the banner only appears after the status loads there, so the server never shows it).
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(DISMISSED);
    } catch {
      return null;
    }
  });
  const found = billing ? noteFor(billing) : null;
  const note = found && found.key !== dismissed ? found : null;

  if (auth !== "signedIn" || !note || pathname === "/plus" || pathname === "/trial" || pathname === note.href) return null;

  return (
    <div className="mx-auto mt-2 flex w-[calc(100%-32px)] max-w-[1180px] items-center gap-3 rounded-full bg-[#121821] py-1.5 pl-4 pr-1.5 text-[13px] text-white">
      <span className="min-w-0 flex-1 truncate">{note.text}</span>
      <Link href={note.href ?? "/plus"} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#121821]">
        {note.action}
      </Link>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED, note.key);
          } catch {}
          setDismissed(note.key);
        }}
        aria-label="Hide"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
