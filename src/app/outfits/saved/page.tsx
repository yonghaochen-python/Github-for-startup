"use client";

import { useEffect, useState } from "react";
import type { PublicPost } from "@/lib/postRules";
import { fetchWithRetry } from "@/lib/fetchRetry";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { OutfitBoard } from "@/components/OutfitBoard";
import { InlineLoading } from "@/components/InlineLoading";
import { MirrorIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import { Tips, type Tip } from "@/components/Tips";
import { OpenPicks, ShareLooksButton } from "@/components/ShareLooks";
import { LiveVideos } from "@/components/LiveVideos";
import { SavedStylist } from "@/components/studio/SavedStylist";

const SAVED_TIPS: Tip[] = [{ target: '[aria-label="Saved. Tap to unsave"]', text: "Tap the red bookmark to unsave a look." }];

type SavedTab = "looks" | "inspiration" | "stylist";

/** Posts saved from the feed (🔖), newest saved first, as a grid of pictures. */
function SavedInspiration() {
  const [posts, setPosts] = useState<PublicPost[] | null>(null);
  useEffect(() => {
    fetch("/api/me/saved-posts", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { posts: PublicPost[] }).posts : []))
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);
  if (!posts) return <InlineLoading label="Loading your inspiration…" />;
  if (posts.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        body="Press 🔖 on an outfit in the feed to keep it here."
        action={
          <Link href="/feed" className={btnPrimary}>
            Browse outfits
          </Link>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/p/${p.id}`} className="block overflow-hidden rounded-[14px] bg-[#f1efeb]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture */}
            <img src={p.imageUrl} alt={p.caption ?? "Outfit"} loading="lazy" className="aspect-[3/4] w-full object-cover" />
          </Link>
          <p className="mt-1 truncate text-[12px] text-[#5d6874]">@{p.creator.username}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SavedLooksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Saved looks, saved posts from the feed (?tab=inspiration) and the AI Stylist's reports (?tab=stylist), switched by
  // the sliding bar.
  const fromUrl = searchParams.get("tab");
  const [tab, setTabState] = useState<SavedTab>(fromUrl === "stylist" || fromUrl === "inspiration" ? fromUrl : "looks");
  function setTab(next: SavedTab) {
    setTabState(next);
    router.replace(next === "looks" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
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
          title={tab === "stylist" ? "Saved Stylist" : tab === "inspiration" ? "Inspiration" : "Saved Looks"}
          actions={
            saved.length > 0 && tab === "looks" ? (
              <>
                <ShareLooksButton looks={saved.filter((o) => o.isFavorite)} onShared={() => setPicksVersion((v) => v + 1)} />
                <Link href="/studio" className={btnSecondary}>
                  <MirrorIcon className="h-4 w-4" /> Open Studio
                </Link>
              </>
            ) : undefined
          }
        />

        <div role="tablist" aria-label="What's saved" className="relative mb-8 inline-grid grid-cols-3 rounded-full bg-white p-1 shadow-[0_1px_0_rgba(18,24,33,0.03),0_8px_22px_rgba(18,30,45,0.06)]">
          {/* The dark pill slides to the chosen side. */}
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-full bg-[#121821] transition-transform duration-300 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none ${
              tab === "stylist" ? "translate-x-[200%]" : tab === "inspiration" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          {(["looks", "inspiration", "stylist"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative rounded-full px-4 py-2 text-[13px] font-semibold sm:px-6 transition-colors duration-300 ${tab === t ? "text-white" : "text-[#4f5b66] hover:text-[#121821]"}`}
            >
              {t === "looks" ? "Looks" : t === "inspiration" ? "Inspiration" : "AI Stylist"}
            </button>
          ))}
        </div>

        {tab === "stylist" ? (
          <SavedStylist />
        ) : tab === "inspiration" ? (
          <SavedInspiration />
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
                <MirrorIcon className="h-4 w-4" /> Open Studio
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
