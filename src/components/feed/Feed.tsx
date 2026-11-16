"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PostActions } from "@/components/feed/PostActions";
import { PiecesButton } from "@/components/feed/PiecesSheet";
import { TryThisOutfit } from "@/components/feed/TryThisOutfit";
import { CommentsButton } from "@/components/feed/Comments";
import { FollowButton } from "@/components/feed/FollowButton";
import { SearchIcon } from "@/components/Icons";
import { useAuth } from "@/components/AuthProvider";
import type { PublicPost } from "@/lib/postRules";

/**
 * Discover, the outfit feed (Virm's first page).
 * - Phones: one outfit per screen, swiped up. The picture fills the top; who posted it, the caption, tags, Pieces and
 *   Try this outfit sit underneath (never over the clothes); like / save / share / ⋯ are small circles on the right.
 * - Computers: an editorial grid in columns, with search at the top.
 * Two lists: For You (everyone, newest first) and Following (people you follow). Search looks through captions, tags,
 * @usernames and the pieces' names, brands and stores. Posts marked "not for me" leave the feed. No AI, nothing paid.
 */
export function Feed() {
  const { status } = useAuth();
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  // Search: what's typed, and the search the feed is showing (set a moment after typing stops).
  const [searching, setSearching] = useState(false);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  // Each search (or tab) starts a new list; answers to an older one are ignored.
  const run = useRef(0);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  function switchTab(next: "foryou" | "following") {
    if (next === tab) return;
    run.current++;
    setTab(next);
    setPosts([]);
    setNext(undefined);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const q = typed.trim();
      if (q === query) return;
      run.current++;
      setQuery(q);
      setPosts([]);
      setNext(undefined);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [typed, query]);

  const loadMore = useCallback(async () => {
    if (loading || next === null) return;
    const mine = run.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (next) params.set("cursor", next);
    if (query) params.set("q", query);
    if (tab === "following") params.set("tab", "following");
    const res = await fetch(`/api/feed${params.size ? `?${params}` : ""}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { posts: PublicPost[]; next: string | null }) : { posts: [], next: null };
    if (mine !== run.current) return;
    setPosts((list) => [...list, ...data.posts.filter((p) => !list.some((q) => q.id === p.id))]);
    setNext(data.next);
    setLoading(false);
  }, [loading, next, query, tab]);

  // Pages load as the end comes near (the first right away, since an empty list's end is already in view).
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const watcher = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), { rootMargin: "1200px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [loadMore]);

  const remove = (id: string) => setPosts((list) => list.filter((p) => p.id !== id));
  const closeSearch = () => {
    setSearching(false);
    setTyped("");
  };
  const empty = next !== undefined && posts.length === 0;
  const emptyText = query
    ? `No outfits match "${query}".`
    : tab === "following"
      ? status === "signedIn"
        ? "Follow people to see their outfits here."
        : "Sign up to follow people."
      : "No outfits yet. Check back soon.";
  const tabs = (dark: boolean) => (
    <div role="tablist" aria-label="Which outfits" className="flex items-center gap-4">
      {(
        [
          ["following", "Following"],
          ["foryou", "For You"],
        ] as const
      )
        // Following needs an account; signed-out visitors just see For You.
        .filter(([value]) => status === "signedIn" || value === "foryou")
        .map(([value, label]) => (
        <button
          key={value}
          role="tab"
          aria-selected={tab === value}
          onClick={() => switchTab(value)}
          className={
            dark
              ? `px-0.5 text-[15px] font-semibold [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] ${tab === value ? "text-white" : "text-white/60"}`
              : `font-display text-[34px] leading-none ${tab === value ? "text-[#121821]" : "text-[#121821]/30 hover:text-[#121821]/60"}`
          }
        >
          {label}
          {dark && <span aria-hidden className={`mx-auto mt-0.5 block h-[2px] w-5 rounded-full ${tab === value ? "bg-white" : "bg-transparent"}`} />}
        </button>
      ))}
    </div>
  );

  const searchBox = (dark: boolean) => (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
      }}
      className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 ${dark ? "bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]"}`}
    >
      <SearchIcon className="h-4 w-4 shrink-0 opacity-70" />
      <input
        type="search"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus={dark}
        placeholder="Search styles, brands, @people"
        aria-label="Search outfits"
        maxLength={40}
        className={`min-w-0 flex-1 bg-transparent text-[14px] outline-none ${dark ? "placeholder:text-white/60" : "placeholder:text-[#8a949e]"}`}
      />
    </form>
  );

  return (
    <main className="flex-1 md:pb-20">
      {/* Computers: a quiet header row, then the grid. */}
      <div className="mx-auto hidden max-w-[1240px] items-center gap-6 px-8 pt-8 md:flex">
        <h1 className="sr-only">Discover</h1>
        {tabs(false)}
        {status === "signedOut" && (
          <div className="flex items-center gap-2">
            <Link href="/login?create=1" className="rounded-full bg-[#121821] px-4 py-2 text-[12.5px] font-semibold text-white">
              Join Virm
            </Link>
            <Link href="/try" className="rounded-full px-3 py-2 text-[12.5px] font-semibold text-[#121821]">
              Try it free
            </Link>
          </div>
        )}
        <div className="ml-auto flex w-full max-w-[340px]">{searchBox(false)}</div>
      </div>

      <div
        className={`relative md:h-auto ${
          // Phones: the feed fills the screen between the top bar and the bottom menu (none when signed out).
          status === "signedIn" ? "h-[calc(100dvh-65px-64px-env(safe-area-inset-bottom))]" : "h-[calc(100dvh-65px)]"
        }`}
      >
        {/* Phones: For You and search over the top of the feed. */}
        <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 px-3 md:hidden">
          {searching ? (
            <>
              {searchBox(true)}
              <button onClick={closeSearch} className="shrink-0 px-2 text-[13px] font-semibold text-white">
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="px-1">{tabs(true)}</div>
              {status === "signedOut" && (
                <div className="mx-auto flex items-center gap-1 whitespace-nowrap rounded-full bg-white/95 p-1 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                  <Link href="/login?create=1" className="rounded-full bg-[#121821] px-3.5 py-1.5 text-[12px] font-semibold text-white">
                    Join Virm
                  </Link>
                  <Link href="/try" className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#121821]">
                    Try it free
                  </Link>
                </div>
              )}
              <button
                onClick={() => setSearching(true)}
                aria-label="Search"
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
              >
                <SearchIcon className="h-[18px] w-[18px]" />
              </button>
            </>
          )}
        </div>

        {empty ? (
          <div className="flex h-full items-center justify-center bg-[#0b0f14] px-6 text-center md:h-auto md:bg-transparent md:py-24">
            <p className="text-[15px] text-white/80 md:text-[#4f5b66]">{emptyText}</p>
          </div>
        ) : (
          <ul className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain bg-[#0b0f14] md:mx-auto md:h-auto md:max-w-[1240px] md:columns-2 md:gap-6 md:overflow-visible md:bg-transparent md:px-8 md:pt-6 lg:columns-3 xl:columns-4">
            {posts.map((p) => {
              const tags = [...p.styleTags, ...p.occasionTags];
              return (
                <li key={p.id} className="flex h-full snap-start snap-always flex-col md:mb-8 md:block md:h-auto md:break-inside-avoid">
                  {/* The outfit: as large as the screen allows, never covered by text. */}
                  <div className="relative min-h-0 flex-1 md:flex-none">
                    <Link href={`/p/${p.id}`} className="group block h-full overflow-hidden md:h-auto md:rounded-[20px] md:bg-[#f1efeb]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture */}
                      <img
                        src={p.imageUrl}
                        alt={p.caption ?? "Outfit"}
                        width={p.width}
                        height={p.height}
                        loading="lazy"
                        className="h-full w-full object-contain md:h-auto md:object-cover md:transition-transform md:duration-700 md:ease-out md:group-hover:scale-[1.02]"
                      />
                    </Link>
                    <div className="absolute bottom-3 right-3 md:hidden">
                      <PostActions post={p} vertical onDisliked={() => remove(p.id)} afterLike={<CommentsButton post={p} />} />
                    </div>
                  </div>

                  {/* Who, what, and the pieces. */}
                  <div className="shrink-0 px-4 pb-4 pt-3 text-white md:px-1 md:pb-0 md:text-[#121821]">
                    <div className="flex items-center gap-2">
                      <Link href={`/u/${p.creator.username}`} className="flex min-w-0 items-center gap-2">
                        <Avatar url={p.creator.avatarUrl} name={p.creator.displayName ?? p.creator.username} size={28} />
                        <span className="truncate text-[13.5px] font-semibold">@{p.creator.username}</span>
                      </Link>
                      {p.followsCreator === false && (
                        <span className="md:hidden">
                          <FollowButton username={p.creator.username} followed={false} tone="dark" />
                        </span>
                      )}
                      <div className="ml-auto hidden md:block">
                        <PostActions post={p} compact />
                      </div>
                    </div>
                    {p.caption && <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-white/90 md:text-[13.5px] md:text-[#29343a]">{p.caption}</p>}
                    {tags.length > 0 && <p className="mt-1 truncate text-[12px] text-white/55 md:text-[#8a949e]">{tags.join(" · ")}</p>}
                    <div className="mt-2.5 flex items-center gap-2">
                      <PiecesButton post={p}>
                        <TryThisOutfit post={p} />
                      </PiecesButton>
                      <TryThisOutfit post={p} variant="feed" />
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={end} aria-hidden className="h-px" />
          </ul>
        )}
        {empty && <div ref={end} aria-hidden className="h-px" />}
      </div>
    </main>
  );
}
