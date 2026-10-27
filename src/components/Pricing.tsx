"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { eyebrow } from "@/components/ui";
import { PLAN_ALLOWANCES } from "@/lib/plans";

/**
 * The planned pricing, shown for feedback only. Nothing here charges, subscribes, or limits anyone: plans, credits and
 * plan limits aren't active, and every paid button says "Coming soon". Features that aren't built are marked
 * "Coming soon" and described in the future tense. To change a price, limit or feature, edit the lists below.
 */

type Feature = { text: string; soon?: string };
type Plan = {
  key: "free" | "plus" | "pro";
  name: string;
  line: string;
  price: string;
  purpose: string;
  photos: number;
  lives: number;
  features: Feature[];
  bestValue?: boolean;
};

const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    line: "Explore your style",
    price: "$0",
    purpose: "Build your closet and see a few outfits on you.",
    photos: PLAN_ALLOWANCES.free.photo,
    lives: PLAN_ALLOWANCES.free.live,
    features: [
      { text: "Personal digital closet" },
      { text: "Browse the shopping catalog" },
      { text: "AI outfit ideas from your closet" },
      { text: "Up to 5 saved looks" },
    ],
  },
  {
    key: "plus",
    name: "Plus",
    line: "Your everyday AI stylist",
    price: "$14.99",
    purpose: "Plan what to wear and try before you buy, week after week.",
    photos: PLAN_ALLOWANCES.plus.photo,
    lives: PLAN_ALLOWANCES.plus.live,
    features: [
      { text: "Everything in Free" },
      { text: "AI outfit ideas from your closet + outfit planning by occasion" },
      { text: "Unlimited saved looks" },
      { text: "Shopping catalog and product importing" },
    ],
    bestValue: true,
  },
  {
    key: "pro",
    name: "Pro",
    line: "A more personal wardrobe experience",
    price: "$24.99",
    purpose: "The most try-ons and live sessions, with personal styling tools on the way.",
    photos: PLAN_ALLOWANCES.pro.photo,
    lives: PLAN_ALLOWANCES.pro.live,
    features: [
      { text: "Everything in Plus" },
      { text: "Style Profile", soon: "Will let you save your colors, fits and favorite styles once, so outfit ideas use them." },
      { text: "Wardrobe Insights", soon: "Will show pieces you never wear, your go-to colors, and what your closet is missing." },
    ],
  },
];

/** The comparison table. "soon" cells are features that aren't built yet. */
const COMPARE: { label: string; cells: [string, string, string] }[] = [
  { label: "Photo try-ons / month", cells: [String(PLAN_ALLOWANCES.free.photo), String(PLAN_ALLOWANCES.plus.photo), String(PLAN_ALLOWANCES.pro.photo)] },
  { label: "Live try-on sessions / month", cells: [String(PLAN_ALLOWANCES.free.live), String(PLAN_ALLOWANCES.plus.live), String(PLAN_ALLOWANCES.pro.live)] },
  { label: "Personal digital closet", cells: ["yes", "yes", "yes"] },
  { label: "Browse the shopping catalog", cells: ["yes", "yes", "yes"] },
  { label: "Product importing", cells: ["no", "yes", "yes"] },
  { label: "AI outfit ideas from your closet", cells: ["yes", "yes", "yes"] },
  { label: "Outfit planning by occasion", cells: ["no", "yes", "yes"] },
  { label: "Saved looks", cells: ["Up to 5", "Unlimited", "Unlimited"] },
  { label: "Style Profile", cells: ["no", "no", "soon"] },
  { label: "Wardrobe Insights", cells: ["no", "no", "soon"] },
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
const SOON_TAG = "ml-2 inline-block rounded-full border px-2 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-[1.2px]";

function Cell({ value }: { value: string }) {
  if (value === "yes") return <span aria-label="Included">●</span>;
  if (value === "no") return <span aria-label="Not included" className="text-[#c3c9ce]">—</span>;
  if (value === "soon")
    return (
      <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#8a5a14]">
        <span className="sm:hidden">Soon</span>
        <span className="hidden sm:inline">Coming soon</span>
      </span>
    );
  return <span>{value}</span>;
}

/**
 * compact: the Upgrade window version (tighter, no comparison table, with a link to the full page). onCompare runs
 * when that link is followed, so the window can close.
 */
export function Pricing({ compact = false, onCompare }: { compact?: boolean; onCompare?: () => void }) {
  const { user } = useAuth();
  // Which "Coming soon" was tapped; the note shows under it (a plain note, nothing is bought).
  const [tapped, setTapped] = useState<string | null>(null);
  const note = (id: string, dark = false) =>
    tapped === id && (
      <p role="status" className={`mt-3 text-[12px] leading-snug ${dark ? "text-[#c9d2da]" : "text-[#4f5b66]"}`}>
        {COMING_SOON}
      </p>
    );
  const pad = compact ? "p-5 sm:p-6" : "p-6 sm:p-8";

  return (
    <>
      <p className={`max-w-2xl text-[#3b4850] ${compact ? "mb-5 text-[12px]" : "mb-8 text-[13px]"} leading-snug`}>
        <span className="mr-2 inline-block rounded-full bg-[#121821] px-2 py-[1px] align-middle text-[9px] font-semibold uppercase tracking-[1.4px] text-white">
          Preview
        </span>
        Paid plans, credits and plan limits aren&apos;t active yet, so nothing can be bought.
      </p>

      {/* The plans: one sheet, columns divided by hairlines; Plus is the inked column. */}
      <section aria-label="Plans" className="grid overflow-hidden rounded-[6px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] md:grid-cols-3">
        {PLANS.map((plan) => {
          const dark = Boolean(plan.bestValue);
          const muted = dark ? "text-[#aeb8c2]" : "text-[#5d6874]";
          return (
            <article
              key={plan.key}
              className={`relative flex flex-col ${pad} ${
                dark ? "order-first bg-[#121821] text-white md:order-none" : `text-[#121821] ${plan.key === "pro" ? "border-t border-black/[0.07] md:border-l md:border-t-0" : "border-t border-black/[0.07] md:border-t-0"}`
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={`text-[11px] font-semibold uppercase tracking-[2.2px] ${muted}`}>{plan.name}</p>
                {plan.bestValue && (
                  <span className="rounded-full bg-white px-2.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#121821]">Best value</span>
                )}
              </div>
              <h3 className={`mt-2 font-display italic leading-[1.05] ${compact ? "text-[22px]" : "text-[26px] sm:text-[28px]"} ${dark ? "text-white" : "text-[#121821]"}`}>
                {plan.line}
              </h3>
              <p className={`flex items-baseline gap-1.5 ${compact ? "mt-3" : "mt-5"}`}>
                <span className={`font-display leading-none tracking-[-1px] ${compact ? "text-[34px]" : "text-[46px]"} ${dark ? "text-white" : "text-[#121821]"}`}>
                  {plan.price}
                </span>
                <span className={`text-[12.5px] ${muted}`}>/ month</span>
              </p>

              {/* Monthly limits, side by side */}
              <dl className={`grid grid-cols-2 border-y ${dark ? "border-white/15" : "border-black/[0.07]"} ${compact ? "mt-4 py-3" : "mt-6 py-4"}`}>
                {[
                  [plan.photos, "photo try-ons"],
                  [plan.lives, plan.lives === 1 ? "live session" : "live sessions"],
                ].map(([n, label], i) => (
                  <div key={String(label)} className={i ? `border-l pl-4 ${dark ? "border-white/15" : "border-black/[0.07]"}` : ""}>
                    <dd className={`font-display leading-none ${compact ? "text-[26px]" : "text-[32px]"} ${dark ? "text-white" : "text-[#121821]"}`}>{n}</dd>
                    <dt className={`mt-1 text-[11px] ${muted}`}>{label} / month</dt>
                  </div>
                ))}
              </dl>

              <p className={`${compact ? "mt-3 text-[12.5px]" : "mt-4 text-[13.5px]"} leading-snug ${dark ? "text-[#dfe5ea]" : "text-[#3b4850]"}`}>{plan.purpose}</p>

              <ul className={`flex flex-1 flex-col ${compact ? "mt-3 gap-1.5 text-[12.5px]" : "mt-5 gap-2.5 text-[13.5px]"} leading-snug`}>
                {plan.features.map((f) => (
                  <li key={f.text} className={f.soon ? (dark ? "text-[#8f9aa5]" : "text-[#7b858e]") : dark ? "text-white" : "text-[#26313a]"}>
                    <span aria-hidden className="mr-2 inline-block h-px w-3 bg-current align-middle opacity-60" />
                    {f.text}
                    {f.soon && (
                      <>
                        <span className={`${SOON_TAG} ${dark ? "border-white/30 text-[#c9d2da]" : "border-[#d9c7ab] text-[#8a5a14]"}`}>Coming soon</span>
                        {!compact && <span className="mt-0.5 block pl-5 text-[12px]">{f.soon}</span>}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <div className={compact ? "mt-5" : "mt-8"}>
                {plan.key === "free" ? (
                  user ? (
                    <span className="flex min-h-[44px] w-full cursor-default items-center justify-center rounded-full text-[13px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]" aria-disabled>
                      Current plan
                    </span>
                  ) : (
                    <Link href="/login" className="flex min-h-[44px] w-full items-center justify-center rounded-full text-[13px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]">
                      Start free
                    </Link>
                  )
                ) : (
                  <button
                    onClick={() => setTapped(plan.key)}
                    className={`flex min-h-[44px] w-full items-center justify-center rounded-full text-[13px] font-medium ${
                      dark ? "bg-white text-[#121821] hover:bg-[#eef1f2]" : "text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
                    }`}
                  >
                    Coming soon
                  </button>
                )}
                {note(plan.key, dark)}
              </div>
            </article>
          );
        })}
      </section>

      {compact ? (
        <Link href="/pricing" onClick={onCompare} className="mt-4 inline-block text-[12.5px] font-semibold text-[#121821] underline-offset-4 hover:underline">
          Compare all features →
        </Link>
      ) : (
        <>
          {/* Photo vs live, in one line each */}
          <section aria-label="Two kinds of try-on" className="mt-14 grid gap-6 border-t border-black/10 pt-8 sm:grid-cols-2">
            {[
              ["Photo try-on", "Your outfit layered onto your full-body photo, as a picture you can save."],
              ["Live try-on session", "Up to 20 seconds of you on camera, wearing the outfit as you move."],
            ].map(([title, text]) => (
              <div key={title}>
                <p className={eyebrow}>{title}</p>
                <p className="mt-2 max-w-sm font-display text-[22px] leading-snug text-[#121821]">{text}</p>
              </div>
            ))}
          </section>

          {/* Feature comparison */}
          <section aria-labelledby="compare" className="mt-14">
            <h2 id="compare" className="font-display text-[32px] leading-tight tracking-[-0.6px] text-[#121821] sm:text-[38px]">
              Compare plans
            </h2>
            <div className="mt-6 overflow-hidden rounded-[6px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
              <table className="w-full border-collapse text-[12.5px] text-[#26313a] sm:text-[13.5px]">
                <thead>
                  <tr className="border-b border-black/[0.07]">
                    <th className="px-3 py-3 text-left font-normal sm:px-6" />
                    {PLANS.map((p) => (
                      <th key={p.key} className={`px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[1.6px] sm:px-4 ${p.bestValue ? "bg-[#f1f3f4] text-[#121821]" : "text-[#5d6874]"}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.label} className="border-b border-black/[0.05] last:border-0">
                      <th scope="row" className="px-3 py-3 text-left font-normal sm:px-6">
                        {row.label}
                      </th>
                      {row.cells.map((c, i) => (
                        <td key={i} className={`px-2 py-3 text-center tabular-nums sm:px-4 ${PLANS[i].bestValue ? "bg-[#f1f3f4]" : ""}`}>
                          <Cell value={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-[#5d6874]">Coming soon features aren&apos;t available yet. Limits are part of the preview and aren&apos;t applied today.</p>
          </section>
        </>
      )}

      {/* Extra credits: live and photo kept apart */}
      <section aria-labelledby="more-try-ons" className={compact ? "mt-8" : "mt-14"}>
        <h2
          id="more-try-ons"
          className={`font-display leading-tight tracking-[-0.6px] text-[#121821] ${compact ? "text-[24px] sm:text-[28px]" : "text-[32px] sm:text-[38px]"}`}
        >
          Need more try-ons?
        </h2>
        <p className={`mt-1 max-w-xl text-[#4f5b66] ${compact ? "text-[12.5px]" : "text-[14px]"}`}>
          Optional packs to top up any plan. Proposed prices; credits can&apos;t be bought yet.
        </p>
        <div className={`grid gap-x-10 sm:grid-cols-2 ${compact ? "mt-3" : "mt-6"}`}>
          {PACKS.map((pack) => (
            <div key={pack.title} className="border-t border-black/10 pt-4">
              <p className="text-[13px] font-semibold text-[#121821]">{pack.title}</p>
              <p className="text-[12px] text-[#5d6874]">{pack.note}</p>
              <ul className="mt-2">
                {pack.options.map((o) => (
                  <Fragment key={o.amount}>
                    <li className={`flex items-center gap-3 ${compact ? "py-2" : "py-3"}`}>
                      <span className="text-[13.5px] text-[#26313a]">{o.amount}</span>
                      <span aria-hidden className="mb-1 flex-1 self-end border-b border-dotted border-black/20" />
                      <span className="font-display text-[22px] leading-none text-[#121821]">{o.price}</span>
                      <button
                        onClick={() => setTapped(pack.title)}
                        className="rounded-full px-3 py-1.5 text-[11.5px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
                      >
                        Coming soon
                      </button>
                    </li>
                  </Fragment>
                ))}
              </ul>
              {note(pack.title)}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * The plans in a sheet over the current page (opened from "Upgrade" in the top bar), so people see pricing without
 * leaving what they're doing. Same content as the Pricing page, more compact; nothing can be bought yet.
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
        <Pricing compact onCompare={onClose} />
      </div>
    </div>,
    document.body
  );
}
