"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { WhatsNewCard, WhatsNewSection } from "@/components/WhatsNew";
import { LiquidGlass } from "@/components/LiquidGlass";
import { MirrorImage, SavedPhotoSetup } from "@/components/SavedPhoto";
import { PageShell, btnPrimary } from "@/components/ui";
import {
  ArrowRightIcon,
  CameraIcon,
  MirrorIcon,
  PlusIcon,
} from "@/components/Icons";
import { SavedStylistStrip } from "@/components/studio/SavedStylist";
import { Tips, type Tip } from "@/components/Tips";

const HOME_TIPS: Tip[] = [
  { target: "#mirror", text: "Your mirror: your latest try-on. Open Studio to try on more." },
  { target: '.site-nav a[href="/closet"], .site-tabbar a[href="/closet"]', text: "Your clothes live in My Closet." },
  { target: '.site-nav a[href="/studio"], .site-tabbar a[href="/studio"]', text: "Studio is your mirror: try outfits on here." },
];



const TEASER_ITEMS = [
  { src: "/sample/white-tshirt.jpg", label: "White crewneck tee" },
  { src: "/sample/light-jeans.jpg", label: "Light-wash jeans" },
  { src: "/sample/camel-coat.jpg", label: "Camel wool overcoat" },
  { src: "/sample/white-sneakers.jpg", label: "White leather sneakers" },
  { src: "/sample/floral-sundress.jpg", label: "Floral sundress" },
  { src: "/sample/turtleneck.jpg", label: "Black ribbed turtleneck" },
  { src: "/sample/plaid-skirt.jpg", label: "Plaid wool skirt" },
  { src: "/sample/knee-boots.jpg", label: "Black knee-high boots" },
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


  // ---------- Signed out: a calm introduction — one satin-mirror moment, then what Virm does. ----------
  if (!signedIn) {
    return (
      <main className="flex-1">
        <section className="relative isolate -mt-px overflow-hidden" style={{ height: "clamp(420px, 60vh, 580px)" }}>
          <LiquidGlass className="absolute inset-0 -z-10" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--page)_35%,transparent)_0%,transparent_30%,transparent_55%,color-mix(in_srgb,var(--page)_55%,transparent)_100%)]" />
          <div className="glass-legible mx-auto flex h-full w-full max-w-[1280px] flex-col justify-end px-5 pb-16 sm:px-8 sm:pb-20">
            <h1
              className="font-display font-normal leading-[0.95] tracking-[-2px] text-[#121821]"
              style={{ fontSize: "clamp(56px, 8.5vw, 116px)" }}
            >
              Your closet,
              <br />
              <em className="text-[#2b4560]">on you.</em>
            </h1>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className={btnPrimary}>
                Log in · Create your closet
              </Link>
            </div>
          </div>
        </section>

        <WhatsNewSection />


        <section className="bg-white">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-24 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-[40px] font-normal leading-[1.02] tracking-[-0.8px] text-[#121821] sm:text-[52px]">
                  Start your Virm collection.
                </h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-[#4f5b66]">
                  20 pieces to start with, men&apos;s and women&apos;s.
                </p>
              </div>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
              {TEASER_ITEMS.map((item) => (
                <figure key={item.src} className="group">
                  <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-[#f4f5f6]">
                    <Image
                      src={item.src}
                      alt={item.label}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      unoptimized
                    />
                  </div>
                  <figcaption className="mt-3 text-[13px] text-[#4f5b66]">{item.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

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
  // Whether any AI Stylist analysis is done (read from saved reports; nothing is generated).
  const [hasStyleProfile, setHasStyleProfile] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/studio")
      .then(async (res) => (res.ok ? ((await res.json()) as { reports?: Record<string, unknown> }).reports ?? {} : {}))
      .then((reports) => setHasStyleProfile(Object.keys(reports).length > 0))
      .catch(() => setHasStyleProfile(false));
  }, []);
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
          {/* Saved AI Stylist reports, next to the saved looks. */}
          <SavedStylistStrip />
        </section>
      </PageShell>
    </main>
  );
}
