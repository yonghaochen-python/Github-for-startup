"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { OutfitBoard } from "@/components/OutfitBoard";
import { InlineLoading } from "@/components/InlineLoading";
import { SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary } from "@/components/ui";

export default function SavedLooksPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Unsaving keeps the card here (switched off) until the page is next opened, so it can be switched back on.
  const [shownIds, setShownIds] = useState<Set<string> | null>(null);

  async function loadOutfits() {
    try {
      const res = await fetch("/api/outfits");
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
      <PageShell>
        <PageHeader
                    title="Saved Looks"
          description="Your favorites, ready to try on."
          actions={
            saved.length > 0 ? (
              <Link href="/studio" className={btnSecondary}>
                <SparkleIcon className="h-4 w-4" /> Open Studio
              </Link>
            ) : undefined
          }
        />

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
            <p className="mb-5 text-[12.5px] text-[#6b7783]">
              {saved.filter((o) => o.isFavorite).length} saved {saved.filter((o) => o.isFavorite).length === 1 ? "look" : "looks"}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {saved.map((outfit) => (
                <OutfitBoard key={outfit.id} outfit={outfit} onSavedChange={onSavedChange} showTryOn />
              ))}
            </div>
          </>
        )}
      </PageShell>
    </main>
  );
}
