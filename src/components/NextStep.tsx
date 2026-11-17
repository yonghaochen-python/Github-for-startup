"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { fetchWithRetry } from "@/lib/fetchRetry";
import { ArrowRightIcon } from "@/components/Icons";
import type { Outfit } from "@/components/OutfitCard";

const WEEK = 7 * 24 * 60 * 60 * 1000;
type Step = { text: string; cta: string; href: string; picture?: string };

/**
 * One useful next action, from what the person has done so far (at the top of My Style). Without a photo it shows nothing: Profile's photo card already asks for one.
 * Reads the person's own closet, outfits and reports; nothing is generated.
 */
function nextStep(closetCount: number, saved: Outfit[], hasStyleProfile: boolean): Step | null {
  if (closetCount === 0) return { text: "Add your first clothing pieces to start building outfits.", cta: "Add clothes", href: "/studio?closet=1&add=1" };
  if (!hasStyleProfile) return { text: "Discover your personal colors with AI Stylist.", cta: "Open AI Stylist", href: "/stylist" };
  const recent = saved.find((o) => Date.now() - new Date((o as { createdAt?: string }).createdAt ?? 0).getTime() < WEEK);
  if (recent) {
    return {
      text: "Revisit and customize your saved outfit.",
      cta: "Open it",
      href: `/studio?outfit=${recent.id}`,
      picture: recent.tryOn ? `/api/outfits/${recent.id}/try-on/image?v=${recent.tryOn}` : recent.layers.flatMap((l) => l.items)[0]?.imageUrl,
    };
  }
  // Nothing more to suggest (Studio is one tap away in the menu anyway).
  return null;
}

export function NextStep() {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (!hasPhoto) return;
    let ignore = false;
    // A request that fails gives null: then nothing is suggested (rather than a wrong step, like "add clothes").
    const json = (url: string) => fetchWithRetry(url).then(async (res) => (res.ok ? res.json() : null)).catch(() => null);
    Promise.all([json("/api/closet/items"), json("/api/outfits"), json("/api/studio")]).then(([closet, outfits, studio]) => {
      if (ignore || !closet || !outfits || !studio) return;
      const saved = (((outfits as { outfits?: Outfit[] }).outfits ?? []) as Outfit[]).filter((o) => o.isFavorite);
      const reports = (studio as { reports?: Record<string, unknown> }).reports ?? {};
      setStep(nextStep(((closet as { items?: unknown[] }).items ?? []).length, saved, Object.keys(reports).length > 0));
    });
    return () => {
      ignore = true;
    };
  }, [hasPhoto]);

  if (!hasPhoto || !step) return null;
  return (
    <section aria-labelledby="next-title" className="mb-6 flex flex-col items-start gap-4 rounded-[24px] bg-[#121821] p-5 text-white shadow-[0_24px_60px_rgba(18,30,45,0.18)] sm:flex-row sm:items-center sm:gap-5 sm:p-7">
      {step.picture && (
        // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image
        <img src={step.picture} alt="" className="hidden h-24 w-[72px] shrink-0 rounded-[12px] bg-white object-cover sm:block" />
      )}
      <div className="min-w-0 flex-1">
        <h2 id="next-title" className="text-[11px] font-semibold uppercase tracking-[2.2px] text-white/60">
          Your Next Step
        </h2>
        <p className="mt-2 font-display text-[24px] leading-tight sm:text-[30px]">{step.text}</p>
      </div>
      <Link href={step.href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#121821]">
        {step.cta} <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}
