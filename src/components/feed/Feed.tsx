"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";
import { Avatar } from "@/components/Avatar";
import { PostActions } from "@/components/feed/PostActions";
import { PiecesButton } from "@/components/feed/PiecesSheet";
import { TryThisOutfit } from "@/components/feed/TryThisOutfit";
import { CommentsButton } from "@/components/feed/Comments";
import { FollowButton } from "@/components/feed/FollowButton";
import { FeedVideo } from "@/components/feed/FeedVideo";
import { PostMore } from "@/components/feed/PostMore";
import { PlusIcon, SearchIcon } from "@/components/Icons";
import { CreateMenu } from "@/components/CreateMenu";
import { useAuth } from "@/components/AuthProvider";
import { FOLLOWING_ON, type PublicPost } from "@/lib/postRules";

/**
 * Discover, the outfit feed (Virm's first page).
 * - Phones: one outfit per screen, swiped up. The picture fills the top; who posted it, the caption, tags, Pieces and
 *   Recreate with My Closet sit underneath (never over the clothes); like / save / share / ⋯ are small circles on the right.
 * - Computers: an editorial grid in columns, with search at the top.
 * Two lists: For You (everyone, newest first) and Following (people you follow). Search looks through captions, tags,
 * @usernames and the pieces' names, brands and stores. Posts marked "not for me" leave the feed. No AI, nothing paid.
 */
/** A post's picture: opens the post only for the person who posted it; for everyone else it just shows the outfit. */
function Pic({ href, onClick, className, children }: { href?: string; onClick: (e: React.MouseEvent) => void; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  ) : (
    <div onClick={onClick} className={className}>
      {children}
    </div>
  );
}

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

  // Phones: pull the first post down (or scroll up past it) to load the newest posts again.
  const list = useRef<HTMLUListElement | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullFrom = useRef<number | null>(null);
  const wheelUp = useRef(0);
  const PULL_TO_REFRESH = 70;
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    const mine = ++run.current;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tab === "following") params.set("tab", "following");
    const res = await fetch(`/api/feed${params.size ? `?${params}` : ""}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { posts: PublicPost[]; next: string | null }) : null;
    if (mine === run.current && data) {
      setPosts(data.posts);
      setNext(data.next);
      setLoading(false);
      list.current?.scrollTo({ top: 0 });
    }
    setRefreshing(false);
    setPull(0);
  }
  // Only on phones, where the feed is its own sliding list (computers show a grid that scrolls with the page).
  const sliding = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const atTop = () => sliding() && (list.current?.scrollTop ?? 0) <= 0;

  // Posting lives here: slide left on a phone (the right side) to open Create (computers: the New post button).
  const [creating, setCreating] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const swipeFrom = useRef<{ x: number; y: number; dir: "right" | "left" | "y" | null; dx: number; postId: string | null } | null>(null);
  const SWIPE_TO_CREATE = 80;
  // Slide right on a post: Recreate it.
  const [swipeLeft, setSwipeLeft] = useState(0);
  const router = useRouter();
  // Asks one post's like / save buttons (phone or computer ones) or its Recreate to act; `n` is new each time.
  const counter = useRef(0);
  const [command, setCommand] = useState<{ id: string; kind: "like" | "toggleLike" | "toggleSave"; n: number; phone: boolean } | null>(null);
  const [recreate, setRecreate] = useState<{ id: string; n: number } | null>(null);
  // Double-tap: a heart shows on the picture.
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
  const lastTap = useRef<{ id: string; at: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  // Computers: the post the keyboard is on (shown with a ring once a key is pressed).
  const [focused, setFocused] = useState<number | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  // Read by the keyboard handler (kept current without re-adding it).
  const postsNow = useRef(posts);
  const focusedNow = useRef(focused);
  useEffect(() => {
    postsNow.current = posts;
    focusedNow.current = focused;
  });

  /**
   * Computers: a two-finger slide on the trackpad works like a phone slide. Fingers to the left (the right side) opens a
   * new post; to the right, Recreate the post under the pointer. The browser's own back / forward slide is held off here.
   */
  const swipeArea = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const area = swipeArea.current;
    if (!area) return;
    let sum = 0;
    let postId: string | null = null;
    let quietUntil = 0;
    let ended: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      sum = 0;
      postId = null;
      setSwipe(0);
      setSwipeLeft(0);
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (ended) clearTimeout(ended);
      ended = setTimeout(reset, 180);
      // Right after a slide has done something, the rest of that slide (the trackpad's glide) is ignored.
      if (e.timeStamp < quietUntil) return;
      if (sum === 0) {
        const over = e.target instanceof Element ? e.target.closest("[data-post-id]") : null;
        const all = postsNow.current;
        postId = over?.getAttribute("data-post-id") ?? (focusedNow.current !== null ? all[focusedNow.current]?.id : null) ?? null;
      }
      sum += e.deltaX;
      if (sum > 0 && status !== "signedIn") return reset();
      if (sum < 0 && !postId) return reset();
      // The same pill the phone shows comes in with the fingers; a little further and it opens.
      const shown = Math.min(140, Math.abs(sum) / 2);
      if (sum > 0) setSwipeLeft(shown);
      else setSwipe(shown);
      if (Math.abs(sum) / 2 >= SWIPE_TO_CREATE + 20) {
        if (sum > 0) setCreating(true);
        else if (postId) setRecreate({ id: postId, n: ++counter.current });
        quietUntil = e.timeStamp + 900;
        reset();
      }
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      area.removeEventListener("wheel", onWheel);
      if (ended) clearTimeout(ended);
    };
  }, [status]);

  /**
   * Keyboard shortcuts: ↓ / J next post, ↑ / K previous, L like, S save, R recreate, Enter open, N new post, / search,
   * ? the list. Never while typing or while a window is open.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[role=dialog]")) return;
      const all = postsNow.current;
      const phone = sliding();
      const box = list.current;
      const current = phone && box ? Math.round(box.scrollTop / (box.clientHeight || 1)) : (focusedNow.current ?? -1);
      const post = current >= 0 ? all[current] : undefined;
      const go = (i: number) => {
        const next = Math.max(0, Math.min(all.length - 1, i));
        if (phone && box) box.scrollTo({ top: next * box.clientHeight, behavior: "smooth" });
        else {
          setFocused(next);
          document.querySelector(`[data-post-index="${next}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      };
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((key === "ArrowDown" || key === "j") && all.length) {
        e.preventDefault();
        go(current + 1);
      } else if ((key === "ArrowUp" || key === "k") && all.length) {
        e.preventDefault();
        go(current - 1);
      } else if (key === "l" && post) setCommand({ id: post.id, kind: "toggleLike", n: ++counter.current, phone });
      else if (key === "s" && post) setCommand({ id: post.id, kind: "toggleSave", n: ++counter.current, phone });
      else if (key === "r" && post) setRecreate({ id: post.id, n: ++counter.current });
      else if (key === "Enter" && post?.editable && !target?.closest("a, button")) router.push(`/p/${post.id}`);
      else if (key === "n" && status === "signedIn") setCreating(true);
      else if (key === "/") {
        e.preventDefault();
        if (phone) setSearching(true);
        else document.querySelector<HTMLInputElement>('input[aria-label="Search outfits"]')?.focus();
      } else if (e.key === "?") setShowKeys(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest posts through refs
  }, [status]);

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
        // Following needs an account (and is off for now); otherwise just For You.
        .filter(([value]) => (FOLLOWING_ON && status === "signedIn") || value === "foryou")
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
        {status === "signedIn" && (
          <button
            onClick={() => setCreating(true)}
            aria-haspopup="dialog"
            className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[#121821] px-4 text-[12.5px] font-semibold text-white hover:bg-[#2a3542]"
          >
            <PlusIcon className="h-4 w-4" /> New post
          </button>
        )}
        <button
          onClick={() => setShowKeys(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-[#4f5b66] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:text-[#121821]"
        >
          ?
        </button>
      </div>

      <div
        ref={swipeArea}
        onTouchStart={(e) => {
          swipeFrom.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            dir: null,
            dx: 0,
            postId: (e.target as Element).closest("[data-post-id]")?.getAttribute("data-post-id") ?? null,
          };
        }}
        onTouchMove={(e) => {
          const from = swipeFrom.current;
          if (!from) return;
          const dx = e.touches[0].clientX - from.x;
          const dy = e.touches[0].clientY - from.y;
          // Decide once which way the finger is going: left (showing the right side) opens a new post (signed in), right
          // Recreates this post, and up and down scrolls posts.
          if (!from.dir && Math.hypot(dx, dy) > 10) {
            const sideways = Math.abs(dx) > Math.abs(dy) * 1.3;
            from.dir = !sideways ? "y" : dx > 0 ? "right" : status === "signedIn" ? "left" : "y";
          }
          if (from.dir === "right") {
            from.dx = dx;
            setSwipe(Math.max(0, Math.min(140, dx)));
          } else if (from.dir === "left") {
            from.dx = dx;
            setSwipeLeft(Math.max(0, Math.min(140, -dx)));
          }
        }}
        onTouchEnd={() => {
          const from = swipeFrom.current;
          if (from?.dir === "left" && -from.dx >= SWIPE_TO_CREATE) setCreating(true);
          if (from?.dir === "right" && from.dx >= SWIPE_TO_CREATE && from.postId) setRecreate({ id: from.postId, n: ++counter.current });
          setSwipe(0);
          setSwipeLeft(0);
          swipeFrom.current = null;
        }}
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

        {/* Slide right to recreate: "Recreate" comes in from the left edge with the finger. */}
        {swipe > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center md:fixed" style={{ transform: `translateX(${swipe - 120}px)`, opacity: Math.min(1, swipe / SWIPE_TO_CREATE) }}>
            <span className={`flex items-center gap-2 rounded-r-full py-3 pl-6 pr-5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${swipe >= SWIPE_TO_CREATE ? "bg-white text-[#121821]" : "bg-white/80 text-[#121821]"}`}>
              Recreate
            </span>
          </div>
        )}
        {/* Slide left to post: "New post" comes in from the right edge with the finger. */}
        {swipeLeft > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center md:fixed" style={{ transform: `translateX(${120 - swipeLeft}px)`, opacity: Math.min(1, swipeLeft / SWIPE_TO_CREATE) }}>
            <span className={`flex items-center gap-2 rounded-l-full py-3 pl-5 pr-6 text-[13px] font-semibold text-[#121821] shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${swipeLeft >= SWIPE_TO_CREATE ? "bg-white" : "bg-white/80"}`}>
              <PlusIcon className="h-4 w-4" /> New post
            </span>
          </div>
        )}
        {/* Pull to refresh: a small round arrow that comes down with the pull and turns while the newest posts load. */}
        {(pull > 0 || refreshing) && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center md:hidden"
            style={{ transform: `translateY(${refreshing ? 24 : pull * 0.6}px)`, opacity: refreshing ? 1 : Math.min(1, pull / PULL_TO_REFRESH) }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#121821] shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
              <svg
                viewBox="0 0 24 24"
                className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`}
                style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" />
              </svg>
              <span className="sr-only">{refreshing ? "Refreshing" : "Pull to refresh"}</span>
            </span>
          </div>
        )}
        {empty ? (
          <div className="flex h-full items-center justify-center bg-[#0b0f14] px-6 text-center md:h-auto md:bg-transparent md:py-24">
            <p className="text-[15px] text-white/80 md:text-[#4f5b66]">{emptyText}</p>
          </div>
        ) : (
          <ul
            ref={list}
            onTouchStart={(e) => {
              pullFrom.current = atTop() ? e.touches[0].clientY : null;
            }}
            onTouchMove={(e) => {
              if (pullFrom.current === null || refreshing) return;
              // A sideways slide (to post or recreate) is never a pull.
              if (swipeFrom.current?.dir === "right" || swipeFrom.current?.dir === "left") return setPull(0);
              const dy = e.touches[0].clientY - pullFrom.current;
              setPull(dy > 0 && atTop() ? Math.min(110, dy * 0.5) : 0);
            }}
            onTouchEnd={() => {
              pullFrom.current = null;
              if (pull >= PULL_TO_REFRESH) void refresh();
              else setPull(0);
            }}
            onWheel={(e) => {
              // A mouse or trackpad: scrolling up past the first post refreshes too.
              if (!atTop() || e.deltaY >= 0 || refreshing) {
                wheelUp.current = 0;
                return;
              }
              wheelUp.current -= e.deltaY;
              if (wheelUp.current > 240) {
                wheelUp.current = 0;
                void refresh();
              }
            }}
            className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain bg-[#0b0f14] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-auto md:h-auto md:max-w-[1240px] md:columns-2 md:gap-6 md:overflow-visible md:bg-transparent md:px-8 md:pt-6 lg:columns-3 xl:columns-4">
            {posts.map((p, index) => {
              const tags = [...p.styleTags, ...p.occasionTags];
              return (
                <li
                  key={p.id}
                  data-post-id={p.id}
                  data-post-index={index}
                  className={`flex h-full snap-start snap-always flex-col md:mb-8 md:block md:h-auto md:break-inside-avoid md:rounded-[24px] md:transition-shadow ${
                    focused === index ? "md:ring-2 md:ring-[#121821] md:ring-offset-4 md:ring-offset-[#f6f5f2]" : ""
                  }`}
                >
                  {/* The outfit: as large as the screen allows, never covered by text. */}
                  <div className="relative min-h-0 flex-1 md:flex-none" style={{ "--r": `${p.width} / ${p.height}` } as React.CSSProperties}>
                    <Pic
                      href={p.editable ? `/p/${p.id}` : undefined}
                      onClick={(e) => {
                        // Phones: a double-tap likes it (on your own post, one tap still opens it, a moment later).
                        if (!sliding()) return;
                        e.preventDefault();
                        const prev = lastTap.current;
                        if (prev && prev.id === p.id && e.timeStamp - prev.at < 300) {
                          if (prev.timer) clearTimeout(prev.timer);
                          lastTap.current = null;
                          if (status === "signedIn") {
                            setCommand({ id: p.id, kind: "like", n: ++counter.current, phone: true });
                            setBurst({ id: p.id, n: counter.current });
                          }
                          return;
                        }
                        const timer = p.editable ? setTimeout(() => router.push(`/p/${p.id}`), 300) : null;
                        lastTap.current = { id: p.id, at: e.timeStamp, timer };
                      }}
                      className="group relative block h-full overflow-hidden md:h-auto md:rounded-[20px] md:bg-[#f1efeb]"
                    >
                      {p.videoUrl ? (
                        <FeedVideo
                          src={p.videoUrl}
                          poster={p.imageUrl}
                          alt={p.caption ?? "Outfit video"}
                          className="h-full w-full object-contain md:aspect-[var(--r)] md:h-auto md:object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- a public post picture
                        <img
                          src={p.imageUrl}
                          alt={p.caption ?? "Outfit"}
                          width={p.width}
                          height={p.height}
                          loading="lazy"
                          className="h-full w-full object-contain md:h-auto md:object-cover md:transition-transform md:duration-700 md:ease-out md:group-hover:scale-[1.02]"
                        />
                      )}
                      {burst?.id === p.id && (
                        <span key={burst.n} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-24 w-24 animate-[heart-pop_.8s_ease-out_forwards] drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]" fill="#e0245e" aria-hidden>
                            <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
                          </svg>
                        </span>
                      )}
                    </Pic>
                    <div className="absolute bottom-3 right-3 md:hidden">
                      <PostActions
                        post={p}
                        vertical
                        onDisliked={() => remove(p.id)}
                        afterLike={<CommentsButton post={p} />}
                        command={command?.id === p.id && command.phone ? command : undefined}
                      />
                    </div>
                  </div>

                  {/* Who, what, and the pieces. */}
                  <div className="shrink-0 px-4 pb-4 pt-3 text-white md:px-1 md:pb-0 md:text-[#121821]">
                    <div className="flex items-center gap-2">
                      <Link href={`/u/${p.creator.username}`} className="flex min-w-0 items-center gap-2">
                        <Avatar url={p.creator.avatarUrl} name={p.creator.displayName ?? p.creator.username} size={28} />
                        <span className="truncate text-[13.5px] font-semibold">@{p.creator.username}</span>
                      </Link>
                      {FOLLOWING_ON && p.followsCreator === false && (
                        <span className="md:hidden">
                          <FollowButton username={p.creator.username} followed={false} tone="dark" />
                        </span>
                      )}
                      <div className="ml-auto hidden md:block">
                        <PostActions post={p} compact command={command?.id === p.id && !command.phone ? command : undefined} />
                      </div>
                    </div>
                    {/* Phones: the description with "… more" (a page with the pieces slides up). */}
                    <div className="md:hidden">
                      <PostMore post={p} />
                    </div>
                    {/* Computers: the description, tags, Pieces and Recreate on the card. */}
                    {p.caption && <p className="mt-1.5 line-clamp-2 hidden text-[13.5px] leading-snug text-[#29343a] md:block">{p.caption}</p>}
                    {tags.length > 0 && <p className="mt-1 hidden truncate text-[12px] text-[#8a949e] md:block">{tags.join(" · ")}</p>}
                    <div className="mt-2.5 hidden items-center gap-2 md:flex">
                      <PiecesButton post={p}>
                        <TryThisOutfit post={p} />
                      </PiecesButton>
                      <TryThisOutfit post={p} variant="feed" openRequest={recreate?.id === p.id ? recreate.n : 0} />
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={end} aria-hidden className="h-px" />
          </ul>
        )}
        {empty && <div ref={end} aria-hidden className="h-px" />}
        {creating && <CreateMenu onClose={() => setCreating(false)} />}
        {showKeys &&
          createPortal(
            <Dialog label="Keyboard shortcuts" onClose={() => setShowKeys(false)} className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-xl">
              <h2 className="text-[17px] font-semibold text-[#121821]">Keyboard shortcuts</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
                {[
                  ["↓  J", "Next post"],
                  ["↑  K", "Previous post"],
                  ["L", "Like"],
                  ["S", "Save"],
                  ["R", "Recreate"],
                  ["Enter", "Open the post"],
                  ["N", "New post"],
                  ["/", "Search"],
                  ["Esc", "Close"],
                ].map(([k, what]) => (
                  <div key={k} className="contents">
                    <dt>
                      <kbd className="rounded-[6px] bg-[#f1f3f4] px-2 py-0.5 font-sans text-[12px] font-semibold text-[#121821]">{k}</kbd>
                    </dt>
                    <dd className="text-[#4f5b66]">{what}</dd>
                  </div>
                ))}
              </dl>
            </Dialog>,
            document.body
          )}
      </div>
    </main>
  );
}
