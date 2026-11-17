"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NextStep } from "@/components/NextStep";
import { DayFlatLay } from "@/components/planner/DayFlatLay";
import { ArrowRightIcon, MirrorIcon, SearchIcon } from "@/components/Icons";
import { PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import type { PlanDays } from "@/lib/planOutfits";
import type { PublicPost } from "@/lib/postRules";
import { freePicks, type Palette } from "@/lib/freePicks";
import { profileColors, type StyleProfile } from "@/lib/styleProfile";

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const studioWith = (pieces: ClothingItem[]) => `/studio?items=${pieces.map((p) => p.id).join(",")}`;

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[28px] leading-none text-[#121821]">{title}</h2>
      {href && link && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#121821]">
          {link} <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

const card = "rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]";

/**
 * My Style, Virm's first page: your own styling first. Your Next Step, today's outfit from the Planner (Try On, Swap),
 * three picks from your closet, Style it, and a little inspiration from Discover. Everything here is free and made from
 * your own closet; Style it (paid AI) only runs in Studio, when you press it here.
 */
export function MyStyle() {
  const [closet, setCloset] = useState<ClothingItem[] | null>(null);
  // The Style Profile's colors (null without one; undefined while loading).
  const [palette, setPalette] = useState<Palette | null | undefined>(undefined);

  useEffect(() => {
    let gone = false;
    fetch("/api/closet/items", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { items: ClothingItem[] }).items : null))
      .then((items) => !gone && setCloset(items ?? []))
      .catch(() => !gone && setCloset([]));
    fetch("/api/studio", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { profile?: StyleProfile }).profile : undefined))
      .then((profile) => !gone && setPalette(profile ? profileColors(profile) : null))
      .catch(() => !gone && setPalette(null));
    return () => {
      gone = true;
    };
  }, []);

  const hasClothes = Boolean(closet && closet.length >= 2);

  return (
    <main className="flex-1 pb-20">
      <PageShell className="max-w-3xl! pt-8">
        <h1 className="font-display text-[44px] leading-none text-[#121821]">My Style</h1>

        <div className="mt-6">
          <NextStep />
        </div>

        {hasClothes && closet && <TodayOutfit closet={closet} />}
        {hasClothes && closet && palette !== undefined && <TopPicks closet={closet} palette={palette} />}
        <StyleIt />
        <Inspiration />
      </PageShell>
    </main>
  );
}

/**
 * Today's outfit, from the Planner: Try On opens it in Studio; Swap asks the Planner for another free suggestion for
 * today and keeps it; See the week opens the Planner. With nothing planned, one free suggestion for today.
 */
function TodayOutfit({ closet }: { closet: ClothingItem[] }) {
  const [today] = useState(() => ymd(new Date()));
  const [ids, setIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    fetch(`/api/planner?month=${today.slice(0, 7)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { days: PlanDays }).days : {}))
      .then((days) => !gone && setIds(days[today]?.items ?? []))
      .catch(() => !gone && setIds([]));
    return () => {
      gone = true;
    };
  }, [today]);

  const byId = new Map(closet.map((p) => [p.id, p]));
  const pieces = (ids ?? []).flatMap((id) => byId.get(id) ?? []);

  /** A new free suggestion for today (never the same as the one now), kept in the Planner. */
  async function suggest() {
    setBusy(true);
    setProblem(null);
    const json = (body: unknown) =>
      fetch("/api/planner/day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(async (res) => ({ ok: res.ok, data: (await res.json().catch(() => ({}))) as { items?: string[]; error?: string } }))
        .catch(() => ({ ok: false, data: {} as { items?: string[]; error?: string } }));
    const made = await json({ date: today, generate: true, current: ids ?? [] });
    if (!made.ok || !made.data.items?.length) {
      setProblem(made.data.error ?? "Couldn't make a new outfit right now.");
      return setBusy(false);
    }
    const saved = await json({ date: today, items: made.data.items, source: "chosen" });
    if (saved.ok) setIds(made.data.items);
    else setProblem("Couldn't keep that outfit. Please try again.");
    setBusy(false);
  }

  if (ids === null) return <div className={`${card} mt-8 h-52 animate-pulse`} />;
  return (
    <section aria-labelledby="today-title" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="today-title" className="font-display text-[28px] leading-none text-[#121821]">
          Today&apos;s outfit
        </h2>
        <Link href={`/planner?day=${today}`} className="group inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#121821]">
          See the week <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className={`${card} flex items-center gap-4 p-4`}>
        <div className="aspect-[4/5] w-[42%] max-w-[200px] shrink-0 overflow-hidden rounded-[16px] bg-[#f6f5f2] p-2">
          {pieces.length > 0 ? <DayFlatLay pieces={pieces} /> : <div className="grid h-full place-items-center text-center text-[12px] text-[#8a949e]">Nothing planned yet</div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {pieces.length > 0 ? (
            <>
              <p className="text-[13px] text-[#5d6874]">{pieces.map((p) => p.description.split(/[,;(]/)[0]).slice(0, 3).join(" · ")}</p>
              <Link href={studioWith(pieces)} className={`${btnPrimary} min-h-[44px]`}>
                <MirrorIcon className="h-4 w-4" /> Try On
              </Link>
              <button onClick={suggest} disabled={busy} className={`${btnSecondary} min-h-[44px]`}>
                {busy ? "Finding one…" : "Swap"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[13.5px] text-[#4f5b66]">An outfit for today, from your closet.</p>
              <button onClick={suggest} disabled={busy} className={`${btnPrimary} min-h-[44px]`}>
                {busy ? "Finding one…" : "Suggest one"}
              </button>
            </>
          )}
          {problem && (
            <p role="alert" className="text-[12px] text-[#a1312a]">
              {problem}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Three outfits from your closet (in your colors with a Style Profile), made here for free. A tap opens it in Studio. */
function TopPicks({ closet, palette }: { closet: ClothingItem[]; palette: Palette | null }) {
  const [picks, setPicks] = useState<Outfit[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- made on the device once the closet is in
    setPicks(freePicks(closet, palette));
  }, [closet, palette]);
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="picks-title" className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="picks-title" className="font-display text-[28px] leading-none text-[#121821]">
          {palette?.wear.length ? "Picks in your colors" : "Top 3 Picks"}
        </h2>
        <button onClick={() => setPicks(freePicks(closet, palette))} className="shrink-0 text-[12.5px] font-semibold text-[#121821] underline-offset-4 hover:underline">
          New picks
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {picks.map((pick, i) => {
          const pieces = pick.layers.flatMap((l) => l.items);
          return (
            <li key={pick.id}>
              <Link href={studioWith(pieces)} aria-label={`Open pick ${i + 1} in Studio`} className={`${card} relative block aspect-[4/5] overflow-hidden p-2 transition-transform hover:-translate-y-0.5`}>
                <span className="absolute left-2 top-2 z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#121821] shadow-sm">{i + 1}</span>
                <DayFlatLay pieces={pieces} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Style it: type a theme; Studio opens and styles it (the AI search only runs because you pressed Style it). */
function StyleIt() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  return (
    <section aria-labelledby="styleit-title" className="mt-10">
      <SectionHead title="Style it" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = theme.trim();
          if (t) router.push(`/studio?theme=${encodeURIComponent(t)}&run=1`);
        }}
        className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]"
      >
        <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[#5d6874]" />
        <label htmlFor="mystyle-theme" className="sr-only">
          Theme
        </label>
        <input
          id="mystyle-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value.slice(0, 120))}
          placeholder="A theme, like old money"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-[#121821] outline-none placeholder:text-[#5d6874]"
        />
        <button type="submit" disabled={!theme.trim()} className={`${btnPrimary} shrink-0 disabled:opacity-40`}>
          Style it
        </button>
      </form>
    </section>
  );
}

/** A little inspiration from Discover: the newest outfits, each opening its post (with Recreate). */
function Inspiration() {
  const [posts, setPosts] = useState<PublicPost[] | null>(null);
  useEffect(() => {
    let gone = false;
    fetch("/api/feed", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { posts: PublicPost[] }).posts : []))
      .then((list) => !gone && setPosts(list.slice(0, 6)))
      .catch(() => !gone && setPosts([]));
    return () => {
      gone = true;
    };
  }, []);
  if (!posts || posts.length === 0) return null;
  return (
    <section aria-labelledby="inspo-title" className="mt-10">
      <SectionHead title="Inspiration" href="/discover" link="See all" />
      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {posts.map((p) => (
          <li key={p.id} className="w-[38vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <Link href={`/p/${p.id}`} className="group block">
              <span className="block aspect-[3/4] overflow-hidden rounded-[18px] bg-[#f1efeb]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture (a video post's cover) */}
                <img src={p.imageUrl} alt={p.caption ?? "Outfit"} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </span>
              <span className="mt-1.5 block truncate text-[12px] font-medium text-[#4f5b66]">@{p.creator.username}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
