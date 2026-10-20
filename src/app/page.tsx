"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import { byLatestTryOn, type Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { WhatsNewCard, WhatsNewSection } from "@/components/WhatsNew";
import { LiquidGlass } from "@/components/LiquidGlass";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup } from "@/components/SavedPhoto";
import { PageShell, btnPrimary, btnSecondary, eyebrow } from "@/components/ui";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CameraIcon,
  ClosetIcon,
  MirrorIcon,
  PlusIcon,
  SparkleIcon,
} from "@/components/Icons";



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
                Create your closet
              </Link>
              <Link href="/login" className={`${btnSecondary} bg-white/90 backdrop-blur`}>
                Log in
              </Link>
            </div>
          </div>
        </section>

        <WhatsNewSection />


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
  if (outfitCount === 0) return { text: "Create your first outfit.", href: "/studio", cta: "Open Studio" };
  return null;
}

function Dashboard({ closet, outfits }: { closet: ClothingItem[]; outfits: Outfit[] }) {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const [settingUpPhoto, setSettingUpPhoto] = useState(false);
  const name = user?.displayName?.trim() || "";
  const saved = outfits.filter((o) => o.isFavorite).sort(byLatestTryOn);
  const latest = outfits[0];
  const step = nextStep(hasPhoto, closet.length, outfits.length);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="flex-1 pb-16">
      {/* Welcome: the one satin-mirror moment on the signed-in home. */}
      <section className="relative isolate overflow-hidden">
        <LiquidGlass className="absolute inset-0 -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--page)_25%,transparent),transparent_40%,color-mix(in_srgb,var(--page)_70%,transparent))]" />
        <PageShell className="glass-legible pb-12 pt-16 sm:pb-14 sm:pt-24">
          <p className="text-[11px] font-semibold uppercase tracking-[2.4px] text-[#26313a]">{greeting}</p>
          <h1 className="mt-3 font-display text-[48px] font-normal leading-[0.98] tracking-[-1.6px] text-[#121821] sm:text-[72px]">
            {name ? (
              <>
                Hello, <em className="text-[#2b4560]">{name}</em>.
              </>
            ) : (
              "Hello."
            )}
          </h1>
          <p className="mt-4 max-w-xl text-[15.5px] font-medium leading-relaxed text-[#1c2328]">
            {closet.length} {closet.length === 1 ? "piece" : "pieces"} in your closet · {saved.length} saved{" "}
            {saved.length === 1 ? "look" : "looks"}.
            {step && (
              <>
                {" "}
                <span className="font-medium text-[#121821]">Next:</span> {step.text}
              </>
            )}
          </p>
          {step && (
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
          )}
        </PageShell>
      </section>

      <PageShell className="pt-8">
        <WhatsNewCard />

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
                <span className="absolute left-4 top-4 bg-white/85 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[1.8px] text-[#26313a]">
                  {user?.look ? "Latest try-on" : hasPhoto ? "Your photo" : "No photo yet"}
                </span>
              </div>
              <div className="flex flex-col justify-center gap-5 p-6 sm:p-10">
                {hasPhoto ? (
                  <>
                    <h2 id="mirror-title" className="font-display text-[38px] font-normal leading-[1.05] text-[#121821] sm:text-[46px]">
                      Your mirror
                    </h2>
                    {user?.look ? (
                      <CurrentLookBar />
                    ) : (
                      <p className="max-w-md text-[14px] leading-relaxed text-[#4f5b66]">Pick any outfit to try on.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href="/studio" className={btnPrimary}>
                        <MirrorIcon className="h-4 w-4" /> Try On an Outfit
                      </Link>
                      <button onClick={() => setSettingUpPhoto(true)} className={btnSecondary}>
                        Change Photo
                      </button>
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
                    </div>
                    <p className="text-[11.5px] text-[#5d6874]">Only you can see it.</p>
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
              body={closet.length > 0 ? "Browse, sort and add clothes." : "Add photos of clothes you own."}
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

          {/* Studio */}
          <section aria-labelledby="stylist-title" className="flex flex-col overflow-hidden rounded-[22px] bg-[#121821] text-white lg:col-span-5">
            <div className="flex-1 p-6 sm:p-8">
              <p className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[2.6px] text-[#a9b6bc]">
                <SparkleIcon className="h-4 w-4" /> Studio
              </p>
              <h2 id="stylist-title" className="font-display text-[34px] font-normal leading-[1.05] sm:text-[40px]">
                Outfits from what you <em>already own</em>.
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-[#c3cdd2]">
                Type a theme or pick pieces, then try it on.
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
                href="/studio"
                className="btn-tactile inline-flex min-h-[46px] items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13.5px] font-medium text-[#121821] hover:bg-[#e9eef3]"
              >
                Open Studio <ArrowRightIcon className="h-4 w-4" />
              </Link>
              {latest && (
                <Link href={`/outfits/${latest.id}`} className="text-[12px] font-semibold text-[#c3cdd2] underline-offset-4 hover:text-white hover:underline">
                  View latest look
                </Link>
              )}
            </div>
          </section>

          {/* Saved Looks */}
          <section aria-labelledby="saved-title" className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:col-span-12">
            <FeatureHead
              Icon={BookmarkIcon}
              id="saved-title"
              title="Saved Looks"
              body={saved.length > 0 ? "Your favorites, ready to try on." : "Save looks you like to find them here."}
            />
            {saved.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 sm:px-8">
                {saved.slice(0, 3).map((outfit, i) => (
                  <Link
                    key={outfit.id}
                    href={`/outfits/${outfit.id}`}
                    className={`group block overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] ${i === 2 ? "hidden sm:block" : ""}`}
                  >
                    {outfit.tryOn ? (
                      <div className="relative aspect-[3/4] bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                        <img
                          src={`/api/outfits/${outfit.id}/try-on/image?v=${outfit.tryOn}`}
                          alt="You wearing this look"
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-px bg-[#e5eaec]">
                        {outfit.layers.flatMap((l) => l.items).slice(0, 4).map((item) => (
                          <div key={item.id} className="relative aspect-square bg-[#f6f7f7]">
                            <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
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
                <Link href="/studio" className={btnSecondary}>Open Studio</Link>
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
