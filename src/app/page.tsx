"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { WhatsNewCard } from "@/components/WhatsNew";
import { GUEST_LOOKS } from "@/lib/guestLooks";
import { LiquidGlass } from "@/components/LiquidGlass";
import { MirrorImage, SavedPhotoSetup } from "@/components/SavedPhoto";
import { PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import {
  ArrowRightIcon,
  CameraIcon,
  MirrorIcon,
  PlusIcon,
} from "@/components/Icons";
import { ModuleVisual } from "@/components/studio/ModuleVisual";
import { portraitUrl } from "@/components/studio/useStudio";
import { isStudioModule, studioModule, type PortraitInfo } from "@/lib/studioModules";
import { Tips, type Tip } from "@/components/Tips";

const HOME_TIPS: Tip[] = [
  { target: "#mirror", text: "Your mirror: your latest try-on. Open Studio to try on more." },
  { target: '.site-nav a[href="/closet"], .site-tabbar a[href="/closet"]', text: "Your clothes live in My Closet." },
  { target: '.site-nav a[href="/studio"], .site-tabbar a[href="/studio"]', text: "Studio is your mirror: try outfits on here." },
];




type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
  layeringRole: LayeringRole;
};

export default function Home() {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const [dataReady, setDataReady] = useState(false);
  const [closet, setCloset] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  // The public intro never touches personal data: nothing is fetched unless a user is signed in.
  useEffect(() => {
    if (!signedIn) return;
    let ignore = false;
    Promise.all([
      fetch("/api/closet/items")
        .then(async (res) => (res.ok ? ((await res.json()) as { items?: ClothingItem[] }).items ?? [] : []))
        .catch(() => []),
      fetch("/api/outfits")
        .then(async (res) => (res.ok ? ((await res.json()) as { outfits?: Outfit[] }).outfits ?? [] : []))
        .catch(() => []),
    ]).then(([items, outfitList]) => {
      if (ignore) return;
      setCloset(items);
      setOutfits(outfitList);
      setDataReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [signedIn]);


  // ---------- Signed out: an introduction that shows what Virm does (no personal data is read). ----------
  if (!signedIn) return <Intro />;

  // ---------- Signed in: a personal styling dashboard — what you have, and what to do next. ----------
  if (!dataReady) return <main className="flex-1" />;

  return <Dashboard closet={closet} outfits={outfits} />;
}

type Step = { text: string; cta: string; href?: string; photo?: true; picture?: string };

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** One useful next action, from what the person has done so far (never the same generic line for everyone). */
function nextStep(hasPhoto: boolean, closet: ClothingItem[], saved: Outfit[], hasStyleProfile: boolean): Step {
  if (!hasPhoto) return { text: "Upload your photo to start your virtual fitting room.", cta: "Upload photo", photo: true };
  if (closet.length === 0) return { text: "Add your first clothing pieces to start building outfits.", cta: "Add clothes", href: "/closet?add=1" };
  if (saved.length === 0) return { text: "Create your first outfit.", cta: "Open Studio", href: "/studio" };
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
  return { text: "Try a new combination using your closet.", cta: "Open Studio", href: "/studio" };
}

/** A section title with its real count, and the way into it. */
function SectionHead({ id, title, count, href }: { id: string; title: string; count: number; href: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-display text-[34px] font-normal leading-none tracking-[-0.6px] text-[#121821] sm:text-[42px]">
        {title} <span className="ml-1 font-sans text-[15px] tracking-normal text-[#5d6874]">{count}</span>
      </h2>
      <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#121821]">
        View all <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function Dashboard({ closet, outfits }: { closet: ClothingItem[]; outfits: Outfit[] }) {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const [settingUpPhoto, setSettingUpPhoto] = useState(false);
  // The finished AI Stylist analyses (read from saved reports; nothing is generated). Null while loading.
  const [reports, setReports] = useState<Record<string, { id: string; createdAt: string }> | null>(null);
  const [portrait, setPortrait] = useState<PortraitInfo | null>(null);
  useEffect(() => {
    fetch("/api/studio")
      .then(async (res) => (res.ok ? ((await res.json()) as { reports?: Record<string, { id: string; createdAt: string }>; portrait?: PortraitInfo | null }) : {}))
      .then((data) => {
        setReports(data.reports ?? {});
        setPortrait(data.portrait ?? null);
      })
      .catch(() => setReports({}));
  }, []);
  const hasStyleProfile = reports === null ? null : Object.keys(reports).length > 0;
  const name = user?.displayName?.trim().split(/\s+/)[0] || "";
  const saved = outfits.filter((o) => o.isFavorite).sort(byLatestTryOn);
  const step = hasStyleProfile === null ? null : nextStep(hasPhoto, closet, saved, hasStyleProfile);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="flex-1 pb-20">
      <Tips id="home" tips={HOME_TIPS} />
      {/* The greeting beside the person's own photo (or latest try-on): the one satin-glass moment. */}
      <section className="relative isolate overflow-hidden">
        <LiquidGlass className="absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--page)_25%,transparent),transparent_40%,color-mix(in_srgb,var(--page)_70%,transparent))]" />
        <PageShell className="glass-legible flex items-end justify-between gap-6 pb-10 pt-14 sm:pb-14 sm:pt-20">
          <h1 className="font-display font-normal leading-[0.95] tracking-[-1.8px] text-[#121821]" style={{ fontSize: "clamp(48px, 7.5vw, 96px)" }}>
            {greeting}
            {name ? (
              <>
                ,<br />
                <em className="text-[#2b4560]">{name}.</em>
              </>
            ) : (
              "."
            )}
          </h1>
          <button
            id="mirror"
            onClick={() => setSettingUpPhoto(true)}
            aria-label={hasPhoto ? "Change your photo" : "Add your photo"}
            className="relative aspect-[3/4] w-[110px] shrink-0 overflow-hidden rounded-t-full rounded-b-[20px] bg-white/50 shadow-[0_24px_60px_rgba(18,30,45,0.18)] ring-1 ring-white/60 backdrop-blur sm:w-[170px]"
          >
            {hasPhoto ? (
              <MirrorImage className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[#5d6874]">
                <CameraIcon className="h-6 w-6" />
              </span>
            )}
          </button>
        </PageShell>
      </section>

      <PageShell className="pt-8">
        <WhatsNewCard />
        {settingUpPhoto && (
          <div className="mb-8 rounded-[22px] bg-white p-4 shadow-[0_14px_36px_rgba(18,30,45,0.06)] sm:p-6">
            <SavedPhotoSetup onSaved={() => setSettingUpPhoto(false)} onCancel={() => setSettingUpPhoto(false)} />
          </div>
        )}

        {/* Your Next Step: one action, chosen from where the person is. */}
        {step && !settingUpPhoto && (
          <section aria-labelledby="next-title" className="mb-14 flex flex-col items-start gap-4 rounded-[24px] bg-[#121821] p-5 text-white sm:flex-row sm:items-center sm:gap-5 shadow-[0_24px_60px_rgba(18,30,45,0.18)] sm:p-7">
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
            {step.photo ? (
              <button onClick={() => setSettingUpPhoto(true)} className="shrink-0 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#121821]">
                {step.cta}
              </button>
            ) : (
              <Link href={step.href!} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#121821]">
                {step.cta} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </section>
        )}

        {/* My Closet: the real count and the newest pieces. */}
        <section aria-labelledby="closet-title" className="mb-14">
          <SectionHead id="closet-title" title="My Closet" count={closet.length} href="/closet" />
          {closet.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {closet.slice(0, 6).map((item, i) => (
                <Link
                  key={item.id}
                  href="/closet"
                  className={`group relative aspect-[4/5] overflow-hidden rounded-[16px] bg-white shadow-[0_10px_28px_rgba(18,30,45,0.06)] ${i >= 3 ? "hidden sm:block" : ""}`}
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.description}
                    fill
                    unoptimized
                    className={`transition-transform duration-700 ease-out group-hover:scale-[1.04] ${item.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-3" : "object-cover"}`}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/closet?add=1" className={btnPrimary}>
              <PlusIcon className="h-4 w-4" /> Add clothes
            </Link>
          )}
        </section>

        {/* Saved Looks: the real count and the latest looks (with their try-on when there is one). */}
        <section aria-labelledby="saved-title" className="mb-6">
          <SectionHead id="saved-title" title="Saved Looks" count={saved.length} href="/outfits/saved" />
          {saved.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {saved.slice(0, 4).map((outfit, i) => (
                <Link
                  key={outfit.id}
                  href={`/studio?outfit=${outfit.id}`}
                  className={`group relative block aspect-[3/4] overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(18,30,45,0.06)] ${i >= 2 ? "hidden sm:block" : ""}`}
                >
                  {outfit.tryOn ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image
                    <img
                      src={`/api/outfits/${outfit.id}/try-on/image?v=${outfit.tryOn}`}
                      alt="You wearing this look"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid h-full grid-cols-2 gap-px bg-[#eef0f1]">
                      {outfit.layers.flatMap((l) => l.items).slice(0, 4).map((item) => (
                        <div key={item.id} className="relative bg-white">
                          <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  {outfit.occasion && (
                    <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold capitalize text-[#121821] backdrop-blur">
                      {outfit.occasion}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/studio" className={btnPrimary}>
              <MirrorIcon className="h-4 w-4" /> Create a look
            </Link>
          )}
        </section>

        <RecentActivity closet={closet} saved={saved} reports={reports ?? {}} portrait={portraitUrl(portrait)} />
      </PageShell>
    </main>
  );
}

const ANALYSIS: Record<string, string> = { color: "Seasonal Color", makeup: "Makeup Guide", hair: "Hair & Color", style: "Personal Style" };
const RECENT_DAYS = 14;

function when(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The last two weeks in one row: looks saved, pieces added, analyses finished. Shown only when something happened;
 * each opens where it lives.
 */
function RecentActivity({
  closet,
  saved,
  reports,
  portrait,
}: {
  closet: ClothingItem[];
  saved: Outfit[];
  reports: Record<string, { id: string; createdAt: string }>;
  portrait: string | null;
}) {
  // "Now" is taken once, when the section first shows.
  const [now] = useState(() => Date.now());
  const since = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent = (iso?: string) => Boolean(iso) && new Date(iso!).getTime() >= since;
  type Entry = { key: string; at: string; label: string; href: string; picture?: string; tint?: string };
  const entries: Entry[] = [
    ...saved
      .filter((o) => recent((o as { createdAt?: string }).createdAt))
      .map((o) => ({
        key: `look-${o.id}`,
        at: (o as { createdAt?: string }).createdAt!,
        label: "Saved look",
        href: `/studio?outfit=${o.id}`,
        picture: o.tryOn ? `/api/outfits/${o.id}/try-on/image?v=${o.tryOn}` : o.layers.flatMap((l) => l.items)[0]?.imageUrl,
      })),
    ...closet
      .filter((i) => recent((i as { createdAt?: string }).createdAt))
      .map((i) => ({ key: `piece-${i.id}`, at: (i as { createdAt?: string }).createdAt!, label: "Added to closet", href: "/closet", picture: i.imageUrl })),
    ...Object.entries(reports)
      .filter(([, r]) => recent(r.createdAt))
      .map(([module, r]) => ({ key: `report-${r.id}`, at: r.createdAt, label: ANALYSIS[module] ?? "Analysis", href: `/stylist/${module}`, tint: module })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
  if (!entries.length) return null;

  return (
    <section aria-labelledby="recent-title" className="mt-14">
      <h2 id="recent-title" className="mb-5 font-display text-[34px] font-normal leading-none tracking-[-0.6px] text-[#121821] sm:text-[42px]">
        Recent
      </h2>
      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {entries.map((e) => (
          <li key={e.key} className="w-[132px] shrink-0">
            <Link href={e.href} className="group block">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[16px] bg-white shadow-[0_10px_28px_rgba(18,30,45,0.06)]">
                {e.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- closet pictures and owner-only try-ons
                  <img
                    src={e.picture}
                    alt=""
                    loading="lazy"
                    className={`absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04] ${
                      e.picture.startsWith("/uploads/cut-") || e.picture.includes("/try-on/") ? "object-contain p-2" : "object-cover"
                    }`}
                  />
                ) : e.tint && isStudioModule(e.tint) ? (
                  portrait ? (
                    // Small tiles: the photo clean, the report's colors in one row under it (same for all four).
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- owner-only portrait */}
                      <img
                        src={portrait}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                      <span className="absolute inset-x-2 bottom-2 flex justify-center gap-1 rounded-full bg-white/80 px-2 py-1.5 backdrop-blur">
                        {studioModule(e.tint).tones.slice(0, 5).map((c) => (
                          <span key={c} className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                        ))}
                      </span>
                    </>
                  ) : (
                    <ModuleVisual module={studioModule(e.tint)} portrait={null} className="absolute inset-0 h-full w-full" />
                  )
                ) : null}
              </span>
              <span className="mt-2 block truncate text-[12.5px] font-semibold text-[#121821]">{e.label}</span>
              <span className="block text-[11.5px] text-[#5d6874]">{when(e.at, now)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The look on the signed-out hero, and the ones in the strip under it (all made in advance for the free demo). */
const HERO_LOOK = GUEST_LOOKS.find((l) => l.slug === "autumn-layers")!;
const STRIP_LOOKS = ["garden-party", "office-winter", "beach-day", "camel-and-cream"]
  .map((slug) => GUEST_LOOKS.find((l) => l.slug === slug))
  .filter((l): l is (typeof GUEST_LOOKS)[number] => Boolean(l));

/**
 * Signed out: what Virm does, shown rather than told. A look's pieces numbered beside the model wearing them (the
 * Studio mirror in miniature), then a few more looks. Every picture is from the free demo; nothing personal is read.
 */
function Intro() {
  return (
    <main className="flex-1 pb-20">
      <section className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:pt-20 lg:gap-16">
        <div>
          <h1 className="font-display font-normal leading-[0.92] tracking-[-2.4px] text-[#121821]" style={{ fontSize: "clamp(58px, 8.4vw, 124px)" }}>
            Your wardrobe.
            <br />
            <em className="text-[#2b4560]">Reimagined.</em>
          </h1>
          <p className="mt-7 max-w-[480px] text-[16.5px] leading-relaxed text-[#4f5b66]">
            Discover new ways to style what you already own. Build outfits, explore your personal style, and see the look before you wear it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/try" className={`${btnPrimary} min-h-[52px] px-7 text-[15px]`}>
              Try It Free <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/login?create=1" className={btnSecondary}>
              Create Account
            </Link>
            <Link href="/login" className="px-3 py-2 text-[14px] font-semibold text-[#121821] underline-offset-4 hover:underline">
              Log In
            </Link>
          </div>
        </div>

        {/* The mirror in miniature: the pieces, numbered, beside the model wearing them. */}
        <Link href="/try" aria-label={`Try the ${HERO_LOOK.name} look in the free demo`} className="group relative mx-auto grid w-full max-w-[560px] grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
          <ol className="flex flex-col justify-center gap-3">
            {HERO_LOOK.items.map((item, i) => (
              <li
                key={item.imageUrl}
                className="flex items-start gap-2 animate-[piece-in_.5s_ease-out_both] motion-reduce:animate-none"
                style={{ animationDelay: `${200 + i * 120}ms` }}
              >
                <span className="pt-1 text-[10px] font-bold tracking-widest text-[#29343a]">{String(i + 1).padStart(2, "0")}</span>
                <span className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-white shadow-[0_10px_24px_rgba(18,30,45,0.08)]">
                  <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                </span>
              </li>
            ))}
          </ol>
          <span className="relative block aspect-[3/5] overflow-hidden rounded-t-[999px] rounded-b-[28px] bg-[#eceae6] shadow-[0_40px_90px_rgba(18,30,45,0.18)]">
            <Image
              src={HERO_LOOK.picture}
              alt={`The demo model wearing the ${HERO_LOOK.name} look`}
              fill
              priority
              unoptimized
              className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
            />
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/60 bg-white/55 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[1.6px] text-[#121821] backdrop-blur-xl">
              Demo
            </span>
          </span>
        </Link>
      </section>

      {/* More looks, made from the same few pieces. */}
      <section aria-label="Demo looks" className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
        <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {STRIP_LOOKS.map((look) => (
            <li key={look.slug} className="w-[62vw] shrink-0 snap-start sm:w-auto">
              <Link href="/try" className="group block">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[22px] bg-[#eceae6]">
                  <Image src={look.picture} alt={`The demo model wearing the ${look.name} look`} fill unoptimized className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </span>
                <span className="mt-3 block text-[13px] font-medium text-[#121821]">{look.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
