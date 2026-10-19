"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { Outfit } from "@/components/OutfitCard";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup, useRemoveSavedPhoto } from "@/components/SavedPhoto";
import { InlineLoading } from "@/components/InlineLoading";
import { ArrowRightIcon, BookmarkIcon, SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, Steps, btnPrimary, btnSecondary, eyebrow } from "@/components/ui";

type Tab = "saved" | "recent";

/**
 * The Try On hub: the person's saved photo on one side, and the looks they can try on the other. Choosing a
 * look opens that outfit's try-on screen, which reuses the saved photo automatically.
 */
export default function TryOnHubPage() {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const searchParams = useSearchParams();
  const [changing, setChanging] = useState(searchParams.get("change") === "1");
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const removeSavedPhoto = useRemoveSavedPhoto();

  useEffect(() => {
    fetch("/api/outfits")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setOutfits(((await res.json()) as { outfits?: Outfit[] }).outfits ?? []);
      })
      .catch(() => setError("Couldn't load your outfits. Refresh the page to try again."));
  }, []);

  const saved = outfits?.filter((o) => o.isFavorite) ?? [];
  const activeTab: Tab = tab ?? (saved.length > 0 ? "saved" : "recent");
  const shown = activeTab === "saved" ? saved : (outfits ?? []);
  const showSetup = !hasPhoto || changing;

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader
                    title="Try On"
          description="Try any outfit on your saved photo."
        />
        <div className="mb-8">
          <Steps steps={["Save your photo", "Pick an outfit", "See it on you"]} />
        </div>

        {showSetup ? (
          <section aria-label="Your try-on photo" className="mb-10">
            <SavedPhotoSetup onSaved={() => setChanging(false)} onCancel={hasPhoto ? () => setChanging(false) : undefined} />
          </section>
        ) : null}

        <div className={showSetup ? "" : "grid gap-8 lg:grid-cols-[320px_1fr]"}>
          {!showSetup && (
            <aside aria-label="Your try-on photo" className="lg:sticky lg:top-24 lg:self-start">
              <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
                <div className="relative aspect-[3/4] overflow-hidden bg-[#dfe6e9]">
                  <MirrorImage className="absolute inset-0 h-full w-full object-cover object-top" />
                </div>
                <div className="p-5">
                  <p className={`${eyebrow} mb-1.5`}>{user?.look ? "Latest try-on" : "Your photo"}</p>
                  {!user?.look && <p className="text-[12.5px] leading-relaxed text-[#4f5b66]">Only you can see this photo.</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href="#choose-title" className={btnPrimary}>
                      Choose Outfit
                    </a>
                    <button onClick={() => setChanging(true)} className={btnSecondary}>
                      Change Photo
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <CurrentLookBar />
                    <button onClick={removeSavedPhoto} className="font-semibold text-[#a03a2f] underline-offset-4 hover:underline">
                      Remove photo
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}

          <section aria-labelledby="choose-title">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`${eyebrow} mb-1.5`}>{hasPhoto ? "Step 2" : "Then"}</p>
                <h2 id="choose-title" className="scroll-mt-24 font-display text-[32px] font-normal leading-tight text-[#121821]">
                  Choose an outfit
                </h2>
                {!hasPhoto && <p className="mt-1 text-[13px] text-[#4f5b66]">Save your photo first.</p>}
              </div>
              {outfits && outfits.length > 0 && (
                <div role="tablist" aria-label="Which outfits" className="flex rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
                  {(["saved", "recent"] as const).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={activeTab === t}
                      onClick={() => setTab(t)}
                      className={`rounded-full px-4 py-2 text-[12px] font-semibold ${
                        activeTab === t ? "bg-[#121821] text-white" : "text-[#4f5b66] hover:text-[#121821]"
                      }`}
                    >
                      {t === "saved" ? `Saved looks (${saved.length})` : `All outfits (${outfits.length})`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <ErrorNote message={error} />}
            {!outfits && !error && <InlineLoading label="Loading your outfits…" />}

            {outfits && outfits.length === 0 && (
              <EmptyState
                title="No outfits yet"
                body="Create an outfit in AI Stylist and it will show up here."
                action={
                  <Link href="/outfits" className={btnPrimary}>
                    <SparkleIcon className="h-4 w-4" /> Create an Outfit
                  </Link>
                }
              />
            )}

            {outfits && outfits.length > 0 && shown.length === 0 && (
              <EmptyState
                title="No saved looks yet"
                body="Switch to All outfits to see everything you've created."
                action={
                  <button onClick={() => setTab("recent")} className={btnSecondary}>
                    Show all outfits
                  </button>
                }
              />
            )}

            {shown.length > 0 && (
              <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {shown.map((outfit) => (
                  <li key={outfit.id}>
                    <OutfitPick outfit={outfit} disabled={!hasPhoto} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageShell>
    </main>
  );
}

function OutfitPick({ outfit, disabled }: { outfit: Outfit; disabled: boolean }) {
  const items = outfit.layers.flatMap((l) => l.items);
  const body = (
    <>
      <div className="grid grid-cols-2 gap-px bg-[#e5eaec]">
        {items.slice(0, 4).map((item) => (
          <div key={item.id} className="relative aspect-square bg-[#f6f7f7]">
            <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold capitalize text-[#121821]">
            {outfit.isFavorite && <BookmarkIcon className="h-3.5 w-3.5 shrink-0" />}
            {outfit.occasion ?? "Outfit"}
          </span>
          <span className="text-[11px] text-[#6b7783]">
            {items.length} {items.length === 1 ? "piece" : "pieces"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-[#121821]">
          Try on <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </>
  );
  if (disabled) {
    return (
      <div aria-disabled className="block cursor-not-allowed overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] opacity-60">
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/outfits/${outfit.id}/try-on?start=1`}
      className="block overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#9fadb4] hover:shadow-[0_14px_30px_rgba(20,28,32,0.1)]"
    >
      {body}
    </Link>
  );
}
