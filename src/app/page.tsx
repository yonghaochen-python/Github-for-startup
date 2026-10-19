"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import type { Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { LiquidGlass } from "@/components/LiquidGlass";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup } from "@/components/SavedPhoto";
import { PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CameraIcon,
  ClosetIcon,
  MirrorIcon,
  PlusIcon,
  SparkleIcon,
} from "@/components/Icons";

const STEPS = [
  { title: "Add clothes", body: "Photograph what you own." },
  { title: "Build your closet", body: "Everything in one place." },
  { title: "Get styled", body: "Say where you're going." },
  { title: "Try it on", body: "See the outfit on you." },
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
        <section className="relative isolate -mt-px overflow-hidden" style={{ height: "min(86vh, 760px)" }}>
          <LiquidGlass className="absolute inset-0 -z-10" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(244,245,246,.35)_0%,rgba(244,245,246,0)_30%,rgba(244,245,246,0)_55%,rgba(244,245,246,.55)_100%)]" />
          <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col justify-end px-5 pb-16 sm:px-8 sm:pb-20">
            <p className={eyebrow}>Your virtual mirror for personal styling</p>
            <h1
              className="mt-4 font-display font-normal leading-[0.95] tracking-[-2px] text-[#121821]"
              style={{ fontSize: "clamp(56px, 8.5vw, 116px)" }}
            >
              Your closet,
              <br />
              <em className="text-[#3d5266]">reflected.</em>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-[#2f3b47]">
              Outfits from the clothes you own, shown on you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={btnPrimary}>
                Create your closet
              </Link>
              <Link href="/login" className={`${btnSecondary} bg-white/60 backdrop-blur`}>
                Log in
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-[1280px] px-5 py-24 sm:px-8">
          <p className={eyebrow}>How Virm works</p>
          <h2 className="mt-3 max-w-2xl font-display text-[44px] font-normal leading-[1.02] tracking-[-1px] text-[#121821] sm:text-[56px]">
            From closet to complete look.
          </h2>
          <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-black/10 pt-6">
                <span className="text-[12px] font-medium tabular-nums text-[#8a96a1]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-display text-[30px] font-normal text-[#121821]">{step.title}</h3>
                <p className="mt-2 max-w-[240px] text-[14px] leading-relaxed text-[#4f5b66]">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-white">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-24 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={eyebrow}>Start exploring instantly</p>
                <h2 className="mt-3 font-display text-[40px] font-normal leading-[1.02] tracking-[-0.8px] text-[#121821] sm:text-[52px]">
                  A closet to style from day one.
                </h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-[#4f5b66]">
                  New accounts start with 20 sample pieces, men&apos;s and women&apos;s. Keep them, edit them, or add your
                  own.
                </p>
              </div>
              <Link href="/login" className={`${btnPrimary} self-start sm:self-auto`}>
                Create your closet
              </Link>
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

function nextStep(hasPhoto: boolean, closetCount: number, outfitCount: number) {
  if (closetCount === 0) return { text: "Add a few clothes to get started.", href: "/closet?add=1", cta: "Add Clothes" };
  if (!hasPhoto) return { text: "Save a full-body photo to try outfits on.", href: "#mirror", cta: "Upload My Photo" };
  if (outfitCount === 0) return { text: "Create your first outfit.", href: "/outfits", cta: "Create an Outfit" };
  return { text: "Try a look on.", href: "/try-on", cta: "Try On an Outfit" };
}

function Dashboard({ closet, outfits }: { closet: ClothingItem[]; outfits: Outfit[] }) {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const [settingUpPhoto, setSettingUpPhoto] = useState(false);
  const name = user?.displayName?.trim() || "";
  const saved = outfits.filter((o) => o.isFavorite);
  const latest = outfits[0];
  const step = nextStep(hasPhoto, closet.length, outfits.length);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="flex-1 pb-16">
      {/* Welcome: the one satin-mirror moment on the signed-in home. */}
      <section className="relative isolate overflow-hidden">
        <LiquidGlass className="absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(244,245,246,.25),rgba(244,245,246,0)_40%,rgba(244,245,246,.7))]" />
        <PageShell className="pb-12 pt-16 sm:pb-14 sm:pt-24">
          <p className={eyebrow}>{greeting}</p>
          <h1 className="mt-3 font-display text-[48px] font-normal leading-[0.98] tracking-[-1.6px] text-[#121821] sm:text-[72px]">
            {name ? (
              <>
                Hello, <em className="text-[#3d5266]">{name}</em>.
              </>
            ) : (
              "Hello."
            )}
          </h1>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-[#2f3b47]">
            {closet.length} {closet.length === 1 ? "piece" : "pieces"} in your closet · {saved.length} saved{" "}
            {saved.length === 1 ? "look" : "looks"}. <span className="font-medium text-[#121821]">Next:</span> {step.text}
          </p>
          <div className="mt-7">
            {step.href.startsWith("#") ? (
              <button onClick={() => setSettingUpPhoto(true)} className={btnPrimary}>
                {step.cta}
              </button>
            ) : (
              <Link href={step.href} className={btnPrimary}>
                {step.cta}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </PageShell>
      </section>

      <PageShell className="pt-8">

        {/* Your Virtual Mirror */}
        <section id="mirror" aria-labelledby="mirror-title" className="mb-6 scroll-mt-24 overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
          {settingUpPhoto ? (
            <div className="p-4 sm:p-6">
              <SavedPhotoSetup onSaved={() => setSettingUpPhoto(false)} onCancel={() => setSettingUpPhoto(false)} />
            </div>
          ) : (
            <div className="grid md:grid-cols-[minmax(0,340px)_1fr]">
              <div className={`relative overflow-hidden bg-[linear-gradient(160deg,#e9eff2,#d6dfe3_55%,#efe9e1)] md:h-auto md:min-h-[400px] ${hasPhoto ? "h-[340px]" : "h-[200px]"}`}>
                {hasPhoto ? (
                  <MirrorImage className="absolute inset-0 h-full w-full object-cover object-top" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 220" className="h-[72%] text-[#b2bfc5]" fill="currentColor" aria-hidden>
                      <circle cx="50" cy="22" r="16" />
                      <path d="M24 48h52a8 8 0 0 1 8 8l-6 70H64l-3 90H39l-3-90H22l-6-70a8 8 0 0 1 8-8z" />
                    </svg>
                  </div>
                )}
                <span className="absolute left-4 top-4 bg-white/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[2px] text-[#3b4850]">
                  {user?.look ? "Your current look" : hasPhoto ? "Your saved photo" : "No photo yet"}
                </span>
              </div>
              <div className="flex flex-col justify-center gap-5 p-6 sm:p-10">
                <p className={eyebrow}>Your Virtual Mirror</p>
                {hasPhoto ? (
                  <>
                    <h2 id="mirror-title" className="font-display text-[38px] font-normal leading-[1.05] text-[#121821] sm:text-[46px]">
                      Ready when you are.
                    </h2>
                    <p className="max-w-md text-[14px] leading-relaxed text-[#4f5b66]">
                      {user?.look
                        ? "Showing your latest try-on."
                        : "Your photo is saved. Pick any outfit to try on."}
                    </p>
                    <CurrentLookBar />
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href="/try-on" className={btnPrimary}>
                        <MirrorIcon className="h-4 w-4" /> Try On an Outfit
                      </Link>
                      <button onClick={() => setSettingUpPhoto(true)} className={btnSecondary}>
                        Change Photo
                      </button>
                      <Link href="/closet" className={btnText}>
                        View My Closet <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 id="mirror-title" className="font-display text-[38px] font-normal leading-[1.05] text-[#121821] sm:text-[46px]">
                      Start with your photo
                    </h2>
                    <p className="max-w-md text-[14px] leading-relaxed text-[#4f5b66]">
                      Upload one full-body photo. You&apos;ll use it for every try-on.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setSettingUpPhoto(true)} className={btnPrimary}>
                        <CameraIcon className="h-4 w-4" /> Upload My Photo
                      </button>
                      <Link href="/closet" className={btnText}>
                        View My Closet <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                    <p className="text-[11.5px] text-[#6b7783]">Only you can see it.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* My Closet */}
          <section aria-labelledby="closet-title" className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:col-span-7">
            <FeatureHead
              Icon={ClosetIcon}
              id="closet-title"
              title="My Closet"
              body={closet.length > 0 ? `${closet.length} pieces.` : "Add photos of clothes you own."}
            />
            {closet.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 px-6 sm:grid-cols-4 sm:px-8">
                {closet.slice(0, 8).map((item, i) => (
                  <div key={item.id} className={`relative aspect-square overflow-hidden rounded-[14px] bg-[#f4f5f6] ${i >= 6 ? "hidden sm:block" : ""}`}>
                    <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-6 rounded-[16px] bg-[#f4f5f6] px-5 py-8 text-[13.5px] text-[#4f5b66] sm:mx-8">
                Your closet is empty. Add a photo of one item, or a few laid out together.
              </div>
            )}
            <FeatureActions>
              <Link href="/closet" className={btnPrimary}>View My Closet</Link>
              <Link href="/closet?add=1" className={btnSecondary}>
                <PlusIcon className="h-4 w-4" /> Add Clothes
              </Link>
            </FeatureActions>
          </section>

          {/* AI Stylist */}
          <section aria-labelledby="stylist-title" className="flex flex-col overflow-hidden rounded-[22px] bg-[#121821] text-white lg:col-span-5">
            <div className="flex-1 p-6 sm:p-8">
              <p className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[2.6px] text-[#a9b6bc]">
                <SparkleIcon className="h-4 w-4" /> AI Stylist
              </p>
              <h2 id="stylist-title" className="font-display text-[34px] font-normal leading-[1.05] sm:text-[40px]">
                Outfits from what you <em>already own</em>.
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-[#c3cdd2]">
                Type a theme or occasion and get three outfits from your closet.
              </p>
              {latest && (
                <div className="mt-6 flex gap-2" aria-label="Your latest outfit">
                  {latest.layers.flatMap((l) => l.items).slice(0, 4).map((item) => (
                    <div key={item.id} className="relative h-20 w-16 overflow-hidden bg-[#f3f5f5] sm:h-24 sm:w-20">
                      <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-5 sm:px-8">
              <Link
                href="/outfits"
                className="btn-tactile inline-flex min-h-[46px] items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13.5px] font-medium text-[#121821] hover:bg-[#e9eef3]"
              >
                Create an Outfit <ArrowRightIcon className="h-4 w-4" />
              </Link>
              {latest && (
                <Link href={`/outfits/${latest.id}`} className="text-[12px] font-semibold text-[#c3cdd2] underline-offset-4 hover:text-white hover:underline">
                  View latest look
                </Link>
              )}
            </div>
          </section>

          {/* Try On */}
          <section aria-labelledby="tryon-title" className="grid grid-cols-[120px_1fr] overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#eef2f6,#e3eaf1)] sm:grid-cols-[160px_1fr] lg:col-span-5">
            <div className="relative min-h-[200px] overflow-hidden bg-[#dfe6e9]">
              {hasPhoto ? (
                <MirrorImage className="absolute inset-0 h-full w-full object-cover object-top" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[#9fadb4]">
                  <MirrorIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="flex flex-col p-5 sm:p-7">
              <p className={`${eyebrow} mb-3 flex items-center gap-2`}>
                <MirrorIcon className="h-4 w-4" /> Try On
              </p>
              <h2 id="tryon-title" className="font-display text-[28px] font-normal leading-[1.1] text-[#121821]">
                One photo, every outfit.
              </h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#4f5b66]">
                {hasPhoto
                  ? "Try any outfit on your saved photo."
                  : "Save one photo, then try on any outfit."}
              </p>
              <Link href="/try-on" className={`${btnPrimary} mt-4 self-start`}>
                Start Try-On
              </Link>
            </div>
          </section>

          {/* Saved Looks */}
          <section aria-labelledby="saved-title" className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:col-span-7">
            <FeatureHead
              Icon={BookmarkIcon}
              id="saved-title"
              title="Saved Looks"
              body={saved.length > 0 ? "Looks you've saved." : "Save looks you like to find them here."}
            />
            {saved.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 sm:px-8">
                {saved.slice(0, 3).map((outfit, i) => (
                  <Link
                    key={outfit.id}
                    href={`/outfits/${outfit.id}`}
                    className={`group block overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] ${i === 2 ? "hidden sm:block" : ""}`}
                  >
                    <div className="grid grid-cols-2 gap-px bg-[#e5eaec]">
                      {outfit.layers.flatMap((l) => l.items).slice(0, 4).map((item) => (
                        <div key={item.id} className="relative aspect-square bg-[#f6f7f7]">
                          <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                    <p className="truncate px-3 py-2 text-[11.5px] font-semibold capitalize text-[#3b4850] group-hover:underline">
                      {outfit.occasion ?? "Saved look"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mx-6 rounded-[16px] bg-[#f4f5f6] px-5 py-8 text-[13.5px] text-[#4f5b66] sm:mx-8">
                Nothing saved yet. Press Save Look on any outfit to keep it here.
              </div>
            )}
            <FeatureActions>
              <Link href="/outfits/saved" className={btnPrimary}>View Saved Looks</Link>
              {saved.length === 0 && (
                <Link href="/outfits" className={btnSecondary}>Create an Outfit</Link>
              )}
            </FeatureActions>
          </section>
        </div>
      </PageShell>
    </main>
  );
}

function FeatureHead({ Icon, id, title, body }: { Icon: typeof ClosetIcon; id: string; title: string; body: string }) {
  return (
    <div className="px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
      <p className={`${eyebrow} mb-3 flex items-center gap-2`}>
        <Icon className="h-4 w-4" /> {title}
      </p>
      <h2 id={id} className="sr-only">{title}</h2>
      <p className="max-w-md text-[13.5px] leading-relaxed text-[#4f5b66]">{body}</p>
    </div>
  );
}

function FeatureActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 px-6 py-6 sm:px-8">{children}</div>;
}
