"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PostActions } from "@/components/feed/PostActions";
import { useAuth } from "@/components/AuthProvider";
import type { PublicPost } from "@/lib/postRules";

/**
 * The outfit feed. Phones: one outfit per screen, swiped up (like short videos), buttons on the right. Computers: the
 * same posts in columns. Newest first for now; posts you mark "not for me" leave your feed. No AI, nothing paid.
 */
export default function FeedPage() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  const { status } = useAuth();
  // Posting: a round ＋ over the feed for signed-in people.
  const createButton =
    status === "signedIn" ? (
      <Link
        href="/create"
        aria-label="Post an outfit"
        className="fixed right-4 top-[76px] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[24px] font-light leading-none text-[#121821] shadow-[0_6px_18px_rgba(0,0,0,0.25)] md:right-8 md:top-[92px]"
      >
        ＋
      </Link>
    ) : null;

  const loadMore = useCallback(async () => {
    if (loading || next === null) return;
    setLoading(true);
    const res = await fetch(`/api/feed${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { posts: PublicPost[]; next: string | null }) : { posts: [], next: null };
    setPosts((list) => [...list, ...data.posts.filter((p) => !list.some((q) => q.id === p.id))]);
    setNext(data.next);
    setLoading(false);
  }, [loading, next]);

  // Pages load as the end comes near (the first right away, since an empty list's end is already in view).
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const watcher = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), { rootMargin: "1200px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [loadMore]);

  const remove = (id: string) => setPosts((list) => list.filter((p) => p.id !== id));

  if (next !== undefined && posts.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24 text-center">
        {createButton}
        <p className="text-[15px] text-[#4f5b66]">No outfits yet. Check back soon.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 md:pb-20">
      {createButton}
      {/* Phones: full-screen cards that snap; computers: columns. */}
      <ul className="h-[calc(100dvh-64px-72px-env(safe-area-inset-bottom))] snap-y snap-mandatory overflow-y-auto md:mx-auto md:h-auto md:max-w-[1180px] md:columns-3 md:gap-5 md:overflow-visible md:px-6 md:pt-8 lg:columns-4">
        {posts.map((p) => (
          <li
            key={p.id}
            className="relative h-full snap-start snap-always bg-[#0b0f14] md:mb-5 md:h-auto md:break-inside-avoid md:overflow-hidden md:rounded-[18px] md:bg-white md:shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]"
          >
            <Link href={`/p/${p.id}`} className="block h-full md:h-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture */}
              <img src={p.imageUrl} alt={p.caption ?? "Outfit"} width={p.width} height={p.height} loading="lazy" className="h-full w-full object-contain md:h-auto md:object-cover" />
            </Link>
            {/* Phones: who and what over the bottom of the photo, buttons down the right. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-5 pt-16 text-white md:hidden">
              <Link href={`/u/${p.creator.username}`} className="pointer-events-auto flex items-center gap-2">
                <Avatar url={p.creator.avatarUrl} name={p.creator.displayName ?? p.creator.username} size={32} />
                <span className="text-[14px] font-semibold">@{p.creator.username}</span>
              </Link>
              {p.caption && <p className="mt-2 line-clamp-2 max-w-[78%] text-[14px] leading-snug">{p.caption}</p>}
              {p.styleTags.length > 0 && <p className="mt-1 text-[12px] text-white/80">{p.styleTags.join(" · ")}</p>}
            </div>
            <div className="absolute bottom-6 right-3 text-white drop-shadow md:hidden">
              <PostActions post={p} vertical onDisliked={() => remove(p.id)} />
            </div>
            {/* Computers: a slim row under the photo. */}
            <div className="hidden px-4 py-3 text-[#121821] md:block">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/u/${p.creator.username}`} className="flex min-w-0 items-center gap-2">
                  <Avatar url={p.creator.avatarUrl} name={p.creator.displayName ?? p.creator.username} size={26} />
                  <span className="truncate text-[13px] font-semibold">@{p.creator.username}</span>
                </Link>
                <PostActions post={p} onDisliked={() => remove(p.id)} />
              </div>
              {p.caption && <p className="mt-2 line-clamp-2 text-[13px] text-[#4f5b66]">{p.caption}</p>}
            </div>
          </li>
        ))}
        <div ref={end} aria-hidden className="h-px" />
      </ul>
    </main>
  );
}
