"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import { OutfitCard, type Outfit } from "@/components/OutfitCard";
import { useAuth } from "@/components/AuthProvider";
import { HeroBlob } from "@/components/HeroBlob";

const STEPS = [
  { title: "Add Clothes", body: "Upload the pieces you already own." },
  { title: "Build Closet", body: "Create a personal digital wardrobe." },
  { title: "Get Styled", body: "Tell your AI stylist where you're going." },
  { title: "See Outfit", body: "Wear a look built from your real clothes." },
];

const TOOLS = [
  { href: "/closet", title: "My Closet", body: "Browse and manage everything you own." },
  { href: "/outfits", title: "AI Stylist", body: "Get a new look built from your real clothes." },
  { href: "/outfits/saved", title: "Saved Looks", body: "Revisit the outfits you've favorited." },
  { href: "/profile", title: "Profile", body: "Your stats, your account, your logout." },
];

const TEASER_ITEMS = [
  { src: "/sample/white-shirt.svg", label: "White fitted shirt" },
  { src: "/sample/blue-jeans.svg", label: "Straight-leg jeans" },
  { src: "/sample/gray-cardigan.svg", label: "Gray cardigan" },
  { src: "/sample/white-sneakers.svg", label: "White sneakers" },
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

  const savedCount = outfits.filter((o) => o.isFavorite).length;
  const showcaseOutfits = outfits.slice(0, 4);

  // ---------- Signed out: a pure introduction — what this is, and how to get started. ----------
  if (!signedIn) {
    return (
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <HeroBlob variant="mercury" className="-right-[12%] top-[-18%] h-[85%] w-[52%] sm:h-[120%] sm:w-[38%]" />
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 px-6 py-28 sm:px-8 sm:py-40">
            <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">AI personal styling</p>
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
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">How Virtual Mirror works</p>
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
              Every new account comes with a small sample closet, so there&apos;s something to work with before you
              upload a single photo.
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

  // ---------- Signed in: the actual tools, not the pitch. ----------
  if (!dataReady) return <main className="flex-1" />;

  const firstName = user?.email.split("@")[0] ?? "";

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-[#dce2e4]">
        <HeroBlob variant="frost" className="-right-[14%] -top-[75%] h-[170%] w-[20%] opacity-40" />
        <div className="relative mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">Welcome back</p>
          <h1
            className="mt-3 font-display font-normal tracking-[-2px] text-[#1c2328]"
            style={{ fontSize: "clamp(40px, 5vw, 64px)" }}
          >
            {firstName ? `Hi, ${firstName}.` : "Your wardrobe."}
          </h1>
          <div className="mt-10 flex flex-wrap items-baseline gap-x-12 gap-y-3">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[32px] font-normal text-[#1c2328]">{closet.length}</span>
              <span className="text-[11px] text-[#8b9088]">pieces in your closet</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[32px] font-normal text-[#1c2328]">{outfits.length}</span>
              <span className="text-[11px] text-[#8b9088]">looks to inspire you</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[32px] font-normal text-[#1c2328]">{savedCount}</span>
              <span className="text-[11px] text-[#8b9088]">looks saved for later</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#dce2e4]">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool, i) => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group border-b border-[#dce2e4] p-7 transition-colors duration-300 hover:bg-white/60 sm:border-r sm:p-8 ${
                i === TOOLS.length - 1 ? "sm:border-r-0" : ""
              } ${i % 2 === 1 ? "lg:border-r" : ""}`}
            >
              <h2 className="font-display text-[28px] font-normal text-[#1c2328]">{tool.title}</h2>
              <p className="mt-2.5 max-w-[200px] text-[12px] leading-relaxed text-[#828d92]">{tool.body}</p>
              <span
                aria-hidden
                className="mt-6 block text-sm text-[#77858c] transition-transform duration-300 ease-out group-hover:translate-x-1.5"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {closet.length > 0 && (
        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-8">
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="font-display text-[30px] font-normal text-[#1c2328]">Your closet at a glance</h2>
              <Link href="/closet" className="shrink-0 text-[11px] font-bold text-[#3e493b]">
                View all →
              </Link>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-2">
              {closet.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="group w-[160px] shrink-0 overflow-hidden rounded-lg bg-[#e2e6e7]"
                  style={{ aspectRatio: "1 / 1.13" }}
                >
                  <div className="relative h-full w-full overflow-hidden">
                    <Image
                      src={item.imageUrl}
                      alt={item.description}
                      fill
                      className="object-cover saturate-[.78] transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showcaseOutfits.length > 0 && (
        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-24 sm:px-8">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">A little inspiration</p>
                <h2
                  className="font-display font-normal tracking-[-1px] text-[#1c2328]"
                  style={{ fontSize: "clamp(34px, 4vw, 50px)" }}
                >
                  Outfits, made for you.
                </h2>
                <p className="mt-2 text-[13px] text-[#8d928a]">Your pieces, put together in a whole new way.</p>
              </div>
              <Link
                href="/outfits"
                className="btn-tactile hidden shrink-0 rounded-[5px] border border-[#cfd5ca] px-5 py-2.5 text-[11px] font-bold text-[#344033] hover:bg-[#eef0e9] sm:block"
              >
                Explore all looks
              </Link>
            </div>
            <div className="grid gap-[32px_24px] sm:grid-cols-2 xl:grid-cols-4">
              {showcaseOutfits.map((outfit) => (
                <OutfitCard key={outfit.id} outfit={outfit} showRationale={false} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
