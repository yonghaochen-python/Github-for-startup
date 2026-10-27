"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { btnPrimary, btnSecondary, eyebrow, surface } from "@/components/ui";

/**
 * The planned pricing, shown for feedback only. Nothing here charges, subscribes or changes anyone's usage:
 * the paid buttons just say "coming soon". To change a price or allowance, edit the lists below.
 */

type Plan = { name: string; price: string; blurb: string; features: string[]; missing?: string[]; suggested?: boolean };

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    blurb: "Get to know your virtual mirror.",
    features: ["10 photo try-ons per month", "Basic My Closet and Saved Looks", "Limited AI outfit recommendations"],
    missing: ["No included live try-on sessions"],
  },
  {
    name: "Plus",
    price: "$14.99",
    blurb: "For getting dressed and shopping with confidence.",
    features: [
      "100 photo try-ons per month",
      "10 live try-on sessions per month",
      "AI outfit recommendations",
      "Digital closet and unlimited saved looks",
      "Access to the Virm Shopping page and product importing",
    ],
    suggested: true,
  },
  {
    name: "Pro",
    price: "$24.99",
    blurb: "For trying on the most, live.",
    features: [
      "100 photo try-ons per month",
      "30 live try-on sessions per month",
      "Everything included in Plus",
      "Access to more advanced outfit planning and shopping features as they become available",
    ],
  },
];

const PACKS: { title: string; note: string; options: { amount: string; price: string }[] }[] = [
  {
    title: "Live try-on",
    note: "See an outfit on you in real time, on camera.",
    options: [
      { amount: "5 sessions", price: "$2.99" },
      { amount: "15 sessions", price: "$7.99" },
    ],
  },
  {
    title: "Photo try-on",
    note: "See an outfit on your full-body photo.",
    options: [
      { amount: "20 photo try-ons", price: "$1.99" },
      { amount: "60 photo try-ons", price: "$4.99" },
    ],
  },
];

const COMING_SOON = "Paid plans and extra try-on credits are coming soon.";

function Check({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`mt-[3px] h-4 w-4 shrink-0 ${off ? "text-[#a3abb2]" : "text-[#121821]"}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {off ? <path d="M4.5 8h7" /> : <path d="M3.5 8.5l3 3 6-7" />}
    </svg>
  );
}

/** compact: tighter cards for the Upgrade window, so the next plan peeks into view and it's clear there's more. */
export function Pricing({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  // Which card's "Coming soon" was tapped; the note shows under it (a plain note, nothing is bought).
  const [tapped, setTapped] = useState<string | null>(null);
  const note = (id: string) =>
    tapped === id && (
      <p role="status" className="mt-3 text-[12.5px] leading-snug text-[#4f5b66]">
        {COMING_SOON}
      </p>
    );

  return (
    <>
      <p className={`max-w-2xl rounded-[14px] bg-[#eef1f2] text-[#3b4850] ${compact ? "mb-5 px-3 py-2 text-[12px] leading-snug" : "mb-6 px-4 py-3 text-[13px] leading-snug"}`}>
        Pricing shown is for preview purposes only. Paid plans and extra credits are not available for purchase yet.
      </p>

      {/* Plans: side by side on wide screens, stacked on phones. Plus is the suggested one. */}
      <section aria-label="Plans" className={`grid md:grid-cols-3 md:items-stretch ${compact ? "gap-4" : "gap-5"}`}>
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`${surface} relative flex flex-col ${compact ? "p-5" : "p-6 sm:p-7"} ${plan.suggested ? "order-first ring-[1.5px] ring-[#121821] md:order-none" : ""}`}
          >
            {plan.suggested && (
              <span className="absolute -top-3 left-6 rounded-full bg-[#121821] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-white">
                Suggested
              </span>
            )}
            <p className={eyebrow}>{plan.name}</p>
            <p className={`flex items-baseline gap-1.5 text-[#121821] ${compact ? "mt-2" : "mt-3"}`}>
              <span className={`font-display leading-none tracking-[-1px] ${compact ? "text-[34px]" : "text-[48px]"}`}>{plan.price}</span>
              <span className="text-[13px] text-[#5d6874]">/ month</span>
            </p>
            <p className={`text-[#4f5b66] ${compact ? "mt-1 text-[12px]" : "mt-2 text-[13px]"}`}>{plan.blurb}</p>
            <ul
              className={`flex flex-1 flex-col border-t border-black/[0.07] leading-snug text-[#26313a] ${
                compact ? "mt-4 gap-1.5 pt-4 text-[12.5px]" : "mt-6 gap-2.5 pt-6 text-[13.5px]"
              }`}
            >
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check />
                  {f}
                </li>
              ))}
              {plan.missing?.map((f) => (
                <li key={f} className="flex gap-2.5 text-[#6b757e]">
                  <Check off />
                  {f}
                </li>
              ))}
            </ul>
            <div className={compact ? "mt-4 [&>*]:min-h-[40px]" : "mt-7"}>
              {plan.name === "Free" ? (
                user ? (
                  <span className={`${btnSecondary} w-full cursor-default`} aria-disabled>
                    Current plan
                  </span>
                ) : (
                  <Link href="/login" className={`${btnSecondary} w-full`}>
                    Start free
                  </Link>
                )
              ) : (
                <button onClick={() => setTapped(plan.name)} className={`${plan.suggested ? btnPrimary : btnSecondary} w-full`}>
                  Coming soon
                </button>
              )}
              {note(plan.name)}
            </div>
          </article>
        ))}
      </section>

      {/* Extra credits: live and photo try-ons kept apart. */}
      <section aria-labelledby="more-try-ons" className={compact ? "mt-10" : "mt-16"}>
        <h2
          id="more-try-ons"
          className={`font-display leading-tight tracking-[-0.6px] text-[#121821] ${compact ? "text-[26px] sm:text-[30px]" : "text-[32px] sm:text-[38px]"}`}
        >
          Need more try-ons?
        </h2>
        <p className="mt-2 max-w-xl text-[14px] text-[#4f5b66]">
          Optional packs to top up any plan. These are proposed prices for future purchases. Credits can&apos;t be bought yet.
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PACKS.map((pack) => (
            <article key={pack.title} className={`${surface} ${compact ? "p-5" : "p-6 sm:p-7"}`}>
              <h3 className="text-[15px] font-semibold text-[#121821]">{pack.title}</h3>
              <p className="mt-1 text-[13px] text-[#5d6874]">{pack.note}</p>
              <ul className="mt-5 divide-y divide-black/[0.07] border-y border-black/[0.07]">
                {pack.options.map((o) => (
                  <li key={o.amount} className={`flex items-center gap-4 ${compact ? "py-3" : "py-4"}`}>
                    <span className="min-w-0 flex-1 text-[14px] text-[#26313a]">{o.amount}</span>
                    <span className="font-display text-[24px] leading-none text-[#121821]">{o.price}</span>
                    <button
                      onClick={() => setTapped(pack.title)}
                      className="rounded-full px-3 py-2 text-[12px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
                    >
                      Coming soon
                    </button>
                  </li>
                ))}
              </ul>
              {note(pack.title)}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * The plans in a sheet over the current page (opened from "Upgrade" in the top bar), so people see pricing without
 * leaving what they're doing. Same content as the Pricing page; nothing can be bought yet.
 */
export function PricingSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Drawn on the page itself (the top bar's blur would otherwise hold it inside the bar).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,16,24,0.55)] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plans"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-[1080px] overflow-y-auto rounded-t-[22px] bg-[#f4f2ee] px-5 pb-8 pt-6 shadow-[0_24px_60px_rgba(10,16,24,0.3)] sm:rounded-[22px] sm:px-8"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[18px] text-[#29343a] shadow-sm hover:text-[#121821]">
          ×
        </button>
        <p className={eyebrow}>Plans</p>
        <h2 className="mb-4 mt-1.5 font-display text-[30px] leading-none tracking-[-0.6px] text-[#121821] sm:text-[36px]">Choose your mirror</h2>
        <Pricing compact />
      </div>
    </div>,
    document.body
  );
}
