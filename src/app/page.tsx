"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import type { Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { HeroBlob } from "@/components/HeroBlob";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup } from "@/components/SavedPhoto";
import { PageHeader, PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
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
  { title: "Add Clothes", body: "Upload the pieces you already own." },
  { title: "Build Closet", body: "Create a personal digital wardrobe." },
  { title: "Get Styled", body: "Tell your AI stylist where you're going." },
  { title: "See Outfit", body: "Wear a look built from your real clothes." },
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
  const { status, user } = useAuth();
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


  // ---------- Signed out: a pure introduction — what this is, and how to get started. ----------
  if (!signedIn) {
    return (
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <HeroBlob variant="mercury" className="-right-[12%] top-[-18%] h-[85%] w-[52%] sm:h-[120%] sm:w-[38%]" />
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 px-6 py-28 sm:px-8 sm:py-40">
            <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">Virm · Your virtual mirror for personal styling</p>
            <h1
              className="max-w-2xl font-medium leading-[0.98] tracking-[-3px] text-[#1c2328]"
              style={{ fontSize: "clamp(52px, 7vw, 108px)", textWrap: "balance" }}
            >
              Your closet.
              <br />
              Your style.
              <br />
              Your <em className="font-display font-normal text-[#5c6a71]">AI stylist.</em>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-[#737d82]">
              Turn the clothes you already own into personalized outfits — and see how they look together.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="btn-tactile rounded-[5px] bg-[#242b30] px-7 py-4 text-xs font-semibold tracking-wide text-white shadow-[inset_0_1px_0_#ffffff35,0_8px_24px_rgba(34,42,47,0.22)] hover:bg-[#3b4750]"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="btn-tactile rounded-[5px] border border-[#cbd3d7] bg-white/40 px-7 py-4 text-xs font-semibold tracking-wide text-[#333f46] hover:border-[#a6b2b8] hover:bg-[#e9edef]"
              >
                Log In
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 pt-28 sm:px-8">
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">How Virm works</p>
            <h2
              className="mb-14 font-display font-normal tracking-[-1.5px] text-[#1c2328]"
              style={{ fontSize: "clamp(38px, 5vw, 58px)", textWrap: "balance" }}
            >
              From closet to complete look.
            </h2>
          </div>
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 border-t border-[#dce2e4] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className={`group border-b border-[#dce2e4] p-7 transition-colors duration-300 hover:bg-white/60 sm:border-r sm:p-8 ${
                  i === STEPS.length - 1 ? "sm:border-r-0" : ""
                } ${i % 2 === 1 ? "lg:border-r" : ""}`}
              >
                <span className="text-[9px] font-bold tracking-[1.5px] text-[#a7b0b4] transition-colors duration-300 group-hover:text-[#7e888e]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mb-2.5 mt-10 font-display text-[30px] font-normal text-[#1c2328]">{step.title}</h3>
                <p className="max-w-[190px] text-[12px] leading-relaxed text-[#828d92]">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-28 sm:px-8">
            <h2
              className="mb-3 font-display font-normal tracking-[-1px] text-[#1c2328]"
              style={{ fontSize: "clamp(32px, 4vw, 44px)" }}
            >
              Start exploring instantly
            </h2>
            <p className="mb-12 max-w-md text-[13px] leading-relaxed text-[#737d82]">
              Every new account starts with a 20-piece sample closet — men&apos;s and women&apos;s, summer and winter — so
              there&apos;s something to style right away. Keep, edit, or remove any piece, and add your own.
            </p>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {TEASER_ITEMS.map((item) => (
                <div key={item.src} className="group overflow-hidden rounded-lg border border-[#cbd7dc] bg-white">
                  <div className="relative aspect-square w-full overflow-hidden bg-[#e2e6e7]">
                    <Image
                      src={item.src}
                      alt={item.label}
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      unoptimized
                    />
                  </div>
                  <p className="px-3 py-2.5 text-xs text-[#737d82]">{item.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="btn-tactile mt-10 inline-block rounded-[5px] bg-[#242b30] px-7 py-4 text-xs font-semibold tracking-wide text-white shadow-[inset_0_1px_0_#ffffff35,0_8px_24px_rgba(34,42,47,0.22)] hover:bg-[#3b4750]"
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ---------- Signed in: a personal styling dashboard — what you have, and what to do next. ----------
  if (!dataReady) return <main className="flex-1" />;

  return <Dashboard email={user?.email ?? ""} closet={closet} outfits={outfits} />;
}

function nextStep(hasPhoto: boolean, closetCount: number, outfitCount: number) {
  if (closetCount === 0) return { text: "Start by adding a few clothes you own — your closet powers everything else.", href: "/closet?add=1", cta: "Add Clothes" };
  if (!hasPhoto) return { text: "Save one full-body photo so you can see any outfit on yourself.", href: "#mirror", cta: "Upload My Photo" };
  if (outfitCount === 0) return { text: "Ask your AI stylist to put together a look from your closet.", href: "/outfits", cta: "Create an Outfit" };
  return { text: "Pick a look and see it on your saved photo.", href: "/try-on", cta: "Try On an Outfit" };
}

function Dashboard({ email, closet, outfits }: { email: string; closet: ClothingItem[]; outfits: Outfit[] }) {
  const { user } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const [settingUpPhoto, setSettingUpPhoto] = useState(false);
  const firstName = email.split("@")[0];
  const saved = outfits.filter((o) => o.isFavorite);
  const latest = outfits[0];
  const step = nextStep(hasPhoto, closet.length, outfits.length);

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader
          label="Home"
          title={<>Good to see you{firstName ? <>, <em className="font-display">{firstName}</em></> : null}.</>}
          description={
            <>
              {closet.length} {closet.length === 1 ? "piece" : "pieces"} in your closet · {saved.length} saved{" "}
              {saved.length === 1 ? "look" : "looks"}. <span className="text-[#1c2328]">Next:</span> {step.text}
            </>
          }
          actions={
            step.href.startsWith("#") ? (
              <button onClick={() => setSettingUpPhoto(true)} className={btnPrimary}>
                {step.cta}
              </button>
            ) : (
              <Link href={step.href} className={btnPrimary}>
                {step.cta}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )
          }
        />

        {/* Your Virtual Mirror */}
        <section id="mirror" aria-labelledby="mirror-title" className="mb-6 scroll-mt-24 border border-[#cbd7dc] bg-white/60">
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
                    <h2 id="mirror-title" className="font-display text-[38px] font-normal leading-[1.05] text-[#1c2328] sm:text-[46px]">
                      Ready when you are.
                    </h2>
                    <p className="max-w-md text-[14px] leading-relaxed text-[#5f6a70]">
                      {user?.look
                        ? "Your latest try-on stays on your photo until you try something else or take it off."
                        : "Your try-on photo is saved. Pick any outfit and see it on you — no new upload needed."}
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
                    <h2 id="mirror-title" className="font-display text-[38px] font-normal leading-[1.05] text-[#1c2328] sm:text-[46px]">
                      Start with your photo
                    </h2>
                    <p className="max-w-md text-[14px] leading-relaxed text-[#5f6a70]">
                      Upload one full-body photo to see how different outfits look on you. Save it once and reuse it
                      whenever you try on a new look.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setSettingUpPhoto(true)} className={btnPrimary}>
                        <CameraIcon className="h-4 w-4" /> Upload My Photo
                      </button>
                      <Link href="/closet" className={btnText}>
                        View My Closet <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                    <p className="text-[11.5px] text-[#7e888e]">Saved privately to your account. Only you can see it.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* My Closet */}
          <section aria-labelledby="closet-title" className="border border-[#cbd7dc] bg-white/60 lg:col-span-7">
            <FeatureHead
              Icon={ClosetIcon}
              id="closet-title"
              title="My Closet"
              body={closet.length > 0 ? `${closet.length} pieces, organized and ready to style.` : "Add photos of clothes you already own to build your digital wardrobe."}
            />
            {closet.length > 0 ? (
              <div className="grid grid-cols-3 gap-px bg-[#dce2e4] sm:grid-cols-4">
                {closet.slice(0, 8).map((item, i) => (
                  <div key={item.id} className={`relative aspect-square bg-[#f3f5f5] ${i >= 6 ? "hidden sm:block" : ""}`}>
                    <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-6 border border-dashed border-[#b8c4ca] px-5 py-8 text-[13px] text-[#5f6a70] sm:mx-8">
                Your closet is empty. Upload a photo of one item — or a few laid out together — and we&apos;ll sort them
                for you.
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
          <section aria-labelledby="stylist-title" className="flex flex-col bg-[#1c2328] text-white lg:col-span-5">
            <div className="flex-1 p-6 sm:p-8">
              <p className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[2.6px] text-[#a9b6bc]">
                <SparkleIcon className="h-4 w-4" /> AI Stylist
              </p>
              <h2 id="stylist-title" className="font-display text-[34px] font-normal leading-[1.05] sm:text-[40px]">
                Outfits from what you <em>already own</em>.
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-[#c3cdd2]">
                Choose an occasion and the weather, and your stylist builds complete looks from your closet.
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
                className="btn-tactile inline-flex min-h-[44px] items-center gap-2 rounded-[5px] bg-white px-5 py-2.5 text-[12.5px] font-semibold text-[#1c2328] hover:bg-[#e9eef0]"
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
          <section aria-labelledby="tryon-title" className="grid grid-cols-[120px_1fr] border border-[#cbd7dc] bg-[linear-gradient(135deg,#f7f3ec,#eef2f3)] sm:grid-cols-[160px_1fr] lg:col-span-5">
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
              <h2 id="tryon-title" className="font-display text-[28px] font-normal leading-[1.1] text-[#1c2328]">
                One photo, every outfit.
              </h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#5f6a70]">
                {hasPhoto
                  ? "Use your saved photo to preview a different outfit — as many as you like."
                  : "Save one photo, then preview as many outfits on yourself as you like."}
              </p>
              <Link href="/try-on" className={`${btnPrimary} mt-4 self-start`}>
                Start Try-On
              </Link>
            </div>
          </section>

          {/* Saved Looks */}
          <section aria-labelledby="saved-title" className="border border-[#cbd7dc] bg-white/60 lg:col-span-7">
            <FeatureHead
              Icon={BookmarkIcon}
              id="saved-title"
              title="Saved Looks"
              body={saved.length > 0 ? "Your favorite combinations, ready to wear again." : "Keep your favorite outfit combinations in one place."}
            />
            {saved.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 sm:px-8">
                {saved.slice(0, 3).map((outfit, i) => (
                  <Link
                    key={outfit.id}
                    href={`/outfits/${outfit.id}`}
                    className={`group block border border-[#dce2e4] bg-white ${i === 2 ? "hidden sm:block" : ""}`}
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
              <div className="mx-6 border border-dashed border-[#b8c4ca] px-5 py-8 text-[13px] text-[#5f6a70] sm:mx-8">
                Nothing saved yet. When the stylist makes a look you love, press Save Look to keep it here.
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
      <p className="max-w-md text-[13.5px] leading-relaxed text-[#5f6a70]">{body}</p>
    </div>
  );
}

function FeatureActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 px-6 py-6 sm:px-8">{children}</div>;
}
