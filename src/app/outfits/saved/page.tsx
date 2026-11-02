"use client";

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/fetchRetry";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { OutfitBoard } from "@/components/OutfitBoard";
import { InlineLoading } from "@/components/InlineLoading";
import { SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import { Tips, type Tip } from "@/components/Tips";
import { OpenPicks, ShareLooksButton } from "@/components/ShareLooks";
import { LiveVideos } from "@/components/LiveVideos";
import { SavedStylist } from "@/components/studio/SavedStylist";

const SAVED_TIPS: Tip[] = [{ target: '[aria-label="Saved. Tap to unsave"]', text: "Tap the red bookmark to unsave a look." }];

export default function SavedLooksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Saved looks on one side, the AI Stylist's reports on the other (?tab=stylist), switched by the sliding bar.
  const [tab, setTabState] = useState<"looks" | "stylist">(searchParams.get("tab") === "stylist" ? "stylist" : "looks");
  function setTab(next: "looks" | "stylist") {
    setTabState(next);
    router.replace(next === "stylist" ? `${pathname}?tab=stylist` : pathname, { scroll: false });
  }
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Unsaving keeps the card here (switched off) until the page is next opened, so it can be switched back on.
  const [shownIds, setShownIds] = useState<Set<string> | null>(null);
  /** Bumped when a new pick starts, so the list of picks reloads. */
  const [picksVersion, setPicksVersion] = useState(0);

  async function loadOutfits() {
    try {
      const res = await fetchWithRetry("/api/outfits");
      if (!res.ok) throw new Error("Failed to load outfits");
      const data = (await res.json()) as { outfits?: Outfit[] };
      setOutfits(data.outfits ?? []);
      setShownIds(new Set((data.outfits ?? []).filter((o) => o.isFavorite).map((o) => o.id)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    loadOutfits();
  }, []);

  const saved = outfits.filter((o) => o.isFavorite || shownIds?.has(o.id)).sort(byLatestTryOn);
  const onSavedChange = (updated: Outfit) => setOutfits((list) => list.map((o) => (o.id === updated.id ? updated : o)));

  return (
    <main className="flex-1 pb-16">
      <Tips id="saved" tips={SAVED_TIPS} delay={1400} />
      <PageShell>
        <PageHeader
          title={tab === "stylist" ? "Saved Stylist" : "Saved Looks"}
          actions={
            saved.length > 0 && tab === "looks" ? (
              <>
                <ShareLooksButton looks={saved.filter((o) => o.isFavorite)} onShared={() => setPicksVersion((v) => v + 1)} />
                <Link href="/studio" className={btnSecondary}>
                  <SparkleIcon className="h-4 w-4" /> Open Studio
                </Link>
              </>
            ) : undefined
          }
        />

        <div role="tablist" aria-label="What's saved" className="relative mb-8 inline-grid grid-cols-2 rounded-full bg-white p-1 shadow-[0_1px_0_rgba(18,24,33,0.03),0_8px_22px_rgba(18,30,45,0.06)]">
          {/* The dark pill slides to the chosen side. */}
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#121821] transition-transform duration-300 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none ${
              tab === "stylist" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          {(["looks", "stylist"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative rounded-full px-6 py-2 text-[13px] font-semibold transition-colors duration-300 ${tab === t ? "text-white" : "text-[#4f5b66] hover:text-[#121821]"}`}
            >
              {t === "looks" ? "Looks" : "AI Stylist"}
            </button>
          ))}
        </div>

        {tab === "stylist" ? (
          <SavedStylist />
        ) : (
          <>
        <OpenPicks refreshKey={picksVersion} />
        <LiveVideos />

        {loading ? (
          <InlineLoading label="Loading your saved looks…" />
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3">
            <ErrorNote message="Couldn't load your saved looks. Please try again." />
            <button onClick={() => { setLoading(true); loadOutfits(); }} className={btnSecondary}>
              Try again
            </button>
          </div>
        ) : saved.length === 0 ? (
          <EmptyState
            title="No saved looks yet"
            body="Press Save Look on any outfit to keep it here."
            action={
              <Link href="/studio" className={btnPrimary}>
                <SparkleIcon className="h-4 w-4" /> Open Studio
              </Link>
            }
          />
        ) : (
          <>
            <p className="mb-5 text-[12.5px] text-[#5d6874]">
              {saved.filter((o) => o.isFavorite).length} saved {saved.filter((o) => o.isFavorite).length === 1 ? "look" : "looks"}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {saved.map((outfit) => (
                <OutfitBoard key={outfit.id} outfit={outfit} onSavedChange={onSavedChange} showTryOn />
              ))}
            </div>
          </>
        )}
          </>
        )}
      </PageShell>
    </main>
  );
}
