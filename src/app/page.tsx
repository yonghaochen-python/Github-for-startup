"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";
import { LoadingScreen } from "@/components/LoadingScreen";
import { afterMinDelay } from "@/lib/minDelay";

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

type OutfitLayer = { role: LayeringRole; items: ClothingItem[] };

type Outfit = {
  id: string;
  rationale: string;
  isFavorite: boolean;
  occasion: string | null;
  layers: OutfitLayer[];
};

type CurrentUser = { id: string; email: string };

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [closet, setCloset] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  useEffect(() => {
    let ignore = false;
    const startedAt = Date.now();
    fetch("/api/auth/me")
      .then((res) => res.json() as Promise<{ user: CurrentUser | null }>)
      .then((data) => {
        if (ignore) return;
        afterMinDelay(startedAt, 500, () => {
          if (ignore) return;
          setUser(data.user);
          setSignedIn(Boolean(data.user));
        });
      })
      .catch(() => {
        if (!ignore) afterMinDelay(startedAt, 500, () => setSignedIn(false));
      });
    fetch("/api/closet/items")
      .then(async (res) => {
        if (ignore || !res.ok) return;
        const data = (await res.json()) as { items?: ClothingItem[] };
        setCloset(data.items ?? []);
      })
      .catch(() => {});
    fetch("/api/outfits")
      .then(async (res) => {
        if (ignore || !res.ok) return;
        const data = (await res.json()) as { outfits?: Outfit[] };
        setOutfits(data.outfits ?? []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  if (signedIn === null) return <LoadingScreen />;

  const savedCount = outfits.filter((o) => o.isFavorite).length;
  const showcaseOutfits = outfits.slice(0, 4);

  // ---------- Signed out: a pure introduction — what this is, and how to get started. ----------
  if (!signedIn) {
    return (
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 px-6 py-24 sm:px-8 sm:py-32">
            <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">AI personal styling</p>
            <h1 className="max-w-xl text-4xl font-medium leading-[1.055] tracking-[-2.2px] text-[#222a2f] sm:text-5xl">
              Your closet.
              <br />
              Your style.
              <br />
              Your <em className="font-display font-normal text-[#68757d]">AI stylist.</em>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-[#737d82]">
              Turn the clothes you already own into personalized outfits — and see how they look together.
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-[5px] bg-[#242b30] px-6 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750]"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="rounded-[5px] border border-[#cbd3d7] px-6 py-3 text-xs font-semibold text-[#333f46] hover:border-[#a6b2b8] hover:bg-[#e9edef]"
              >
                Log In
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 pt-20 sm:px-8">
            <h2 className="mb-8 font-display text-[46px] font-normal tracking-[-1px] text-[#222a2f]">
              From closet to complete
              <br />
              look.
            </h2>
            <p className="mb-8 text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">How Virtual Mirror works</p>
          </div>
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 border-t border-[#dce2e4] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className={`border-b border-[#dce2e4] p-6 sm:border-r ${i === STEPS.length - 1 ? "sm:border-r-0" : ""} ${
                  i % 2 === 1 ? "lg:border-r" : ""
                }`}
              >
                <span className="text-[9px] font-bold tracking-[1.5px] text-[#929da3]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mb-2 mt-8 font-display text-[27px] font-normal text-[#222a2f]">{step.title}</h3>
                <p className="max-w-[180px] text-[11px] leading-relaxed text-[#828d92]">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-8">
            <h2 className="mb-2 font-display text-[32px] font-normal tracking-tight text-[#222a2f]">
              Start exploring instantly
            </h2>
            <p className="mb-8 max-w-md text-sm text-[#737d82]">
              Every new account comes with a small sample closet, so there&apos;s something to work with before you
              upload a single photo.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {TEASER_ITEMS.map((item) => (
                <div key={item.src} className="overflow-hidden rounded-lg border border-[#cbd7dc] bg-white">
                  <div className="relative aspect-square w-full bg-[#e2e6e7]">
                    <Image src={item.src} alt={item.label} fill className="object-cover" unoptimized />
                  </div>
                  <p className="px-3 py-2 text-xs text-[#737d82]">{item.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="mt-8 inline-block rounded-[5px] bg-[#242b30] px-6 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750]"
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ---------- Signed in: the actual tools, not the pitch. ----------
  const firstName = user?.email.split("@")[0] ?? "";

  return (
    <main className="flex-1">
      <section className="border-b border-[#dce2e4]">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">Welcome back</p>
          <h1 className="mt-2 font-display text-4xl font-normal tracking-[-2px] text-[#222a2f] sm:text-5xl">
            {firstName ? `Hi, ${firstName}.` : "Your wardrobe."}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-10">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[28px] font-normal text-[#222a2f]">{closet.length}</span>
              <span className="text-[11px] text-[#8b9088]">pieces in your closet</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[28px] font-normal text-[#222a2f]">{outfits.length}</span>
              <span className="text-[11px] text-[#8b9088]">looks to inspire you</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[28px] font-normal text-[#222a2f]">{savedCount}</span>
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
              className={`border-b border-[#dce2e4] p-6 transition-colors hover:bg-[#e9edef] sm:border-r ${
                i === TOOLS.length - 1 ? "sm:border-r-0" : ""
              } ${i % 2 === 1 ? "lg:border-r" : ""}`}
            >
              <h2 className="font-display text-[27px] font-normal text-[#222a2f]">{tool.title}</h2>
              <p className="mt-2 max-w-[200px] text-[11px] leading-relaxed text-[#828d92]">{tool.body}</p>
              <span aria-hidden className="mt-4 block text-sm text-[#77858c]">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {closet.length > 0 && (
        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-8">
            <div className="mb-6 flex items-end justify-between gap-6">
              <h2 className="font-display text-[28px] font-normal text-[#222a2f]">Your closet at a glance</h2>
              <Link href="/closet" className="shrink-0 text-[11px] font-bold text-[#3e493b]">
                View all →
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {closet.slice(0, 8).map((item) => (
                <div key={item.id} className="w-[140px] shrink-0 overflow-hidden rounded-lg bg-[#e2e6e7]" style={{ aspectRatio: "1 / 1.13" }}>
                  <div className="relative h-full w-full">
                    <Image src={item.imageUrl} alt={item.description} fill className="object-cover saturate-[.78]" unoptimized />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showcaseOutfits.length > 0 && (
        <section className="border-b border-[#dce2e4]">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-8">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">A little inspiration</p>
                <h2 className="font-display text-[46px] font-normal tracking-[-1px] text-[#222a2f]">Outfits, made for you.</h2>
                <p className="mt-1 text-[13px] text-[#8d928a]">Your pieces, put together in a whole new way.</p>
              </div>
              <Link
                href="/outfits"
                className="hidden shrink-0 rounded-[5px] border border-[#cfd5ca] px-4 py-2.5 text-[11px] font-bold text-[#344033] hover:bg-[#eef0e9] sm:block"
              >
                Explore all looks
              </Link>
            </div>
            <div className="grid gap-[27px_22px] sm:grid-cols-2 lg:grid-cols-4">
              {showcaseOutfits.map((outfit) => (
                <Link
                  key={outfit.id}
                  href={`/outfits/${outfit.id}`}
                  className="block border transition-transform hover:-translate-y-[3px]"
                  style={{
                    borderColor: "#cbd7dc",
                    background: "linear-gradient(145deg, #fff, #edf4f6 72%, #f2e8ea)",
                    boxShadow: "inset 0 1px #fff, 0 5px 18px #25323a12",
                  }}
                >
                  <div className="flex min-h-[76px] items-start justify-between gap-4 border-b border-[#dce2e4] px-4 py-3.5">
                    <div>
                      <span className="mb-1.5 block text-[8px] font-bold tracking-[1.7px] text-[#89949a]">
                        {outfit.occasion ?? "OUTFIT"}
                      </span>
                      <h3 className="text-sm font-bold uppercase tracking-[-0.15px] text-[#222a2f]">Look</h3>
                    </div>
                    {outfit.isFavorite && <span className="shrink-0 text-xs text-[#354134]">★</span>}
                  </div>
                  <div className="overflow-hidden bg-white">
                    <EditorialOutfitVisual items={outfit.layers.flatMap((layer) => layer.items)} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
