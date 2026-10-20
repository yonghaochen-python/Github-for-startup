"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GUEST_LOOKS, GUEST_MODEL_PHOTO } from "@/lib/guestLooks";
import { LAYER_LABELS, type LayeringRole } from "@/lib/layering";
import { PageHeader, PageShell, btnPrimary } from "@/components/ui";

/**
 * "Try it free": pick a ready-made outfit and see it on the example model. Every picture was made in advance,
 * so this uses no AI, no account and no storage, and nothing is saved. Own clothes and photos need an account.
 */
const SHOWN = 3;

/** Three random outfits, none of them from the set being replaced. */
function pickThree(exclude: string[]): string[] {
  const pool = GUEST_LOOKS.map((l) => l.slug).filter((s) => !exclude.includes(s));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SHOWN);
}

export default function TryFreePage() {
  const [slug, setSlug] = useState<string | null>(null);
  // The first three until the page is in the browser, then a random three (keeps server and browser in step).
  const [shown, setShown] = useState<string[]>(() => GUEST_LOOKS.slice(0, SHOWN).map((l) => l.slug));
  const look = GUEST_LOOKS.find((l) => l.slug === slug) ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a random start is only possible in the browser
    setShown(pickThree([]));
  }, []);

  function shuffle() {
    const next = pickThree(shown);
    setShown(next);
    setSlug(next[0]);
  }

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader title="Try it free" description="Pick an outfit to see it on our model. Just for fun, nothing is saved." />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          {/* The model wearing the chosen look. */}
          <section aria-label="On the model" className="min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:sticky lg:top-24">
            <div className="relative mx-auto h-[min(52vh,520px)] min-h-[300px] w-full bg-[#f4f5f6] lg:h-[min(620px,calc(100vh-300px))] lg:min-h-[360px]">
              <Image
                key={look?.picture ?? GUEST_MODEL_PHOTO}
                src={look?.picture ?? GUEST_MODEL_PHOTO}
                alt={look ? `The model wearing the ${look.name} outfit` : "The example model"}
                fill
                unoptimized
                priority
                className="object-contain"
                style={{ objectFit: "contain" }}
              />
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#3b4850]">
                {look ? look.name : "Example model"}
              </span>
            </div>
            <div className="border-t border-black/[0.06] p-4 sm:p-5">
              {look ? (
                <ul className="flex flex-wrap gap-3">
                  {look.items.map((item) => (
                    <li key={item.imageUrl} className="flex items-center gap-2.5">
                      <span className="relative h-12 w-12 overflow-hidden rounded-[10px] bg-[#f4f5f6]">
                        <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
                      </span>
                      <span className="text-[12px] leading-tight text-[#3b4850]">
                        {item.description}
                        <span className="block text-[11px] text-[#5d6874]">{LAYER_LABELS[item.layeringRole as LayeringRole]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[#4f5b66]">Pick an outfit to try it on.</p>
              )}
            </div>
          </section>

          {/* The ready-made outfits. */}
          <section aria-label="Outfits" className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] text-[#4f5b66]">Pick one, or shuffle for more.</p>
              <button
                onClick={shuffle}
                className="btn-tactile inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:bg-[#f4f5f6]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                Shuffle
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {shown.map((s) => GUEST_LOOKS.find((l) => l.slug === s)!).map((option) => {
                const active = option.slug === slug;
                return (
                  <li key={option.slug}>
                    <button
                      onClick={() => setSlug(option.slug)}
                      aria-pressed={active}
                      className={`btn-tactile block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] ${
                        active ? "shadow-[inset_0_0_0_2px_#121821,0_10px_28px_rgba(18,30,45,0.08)]" : ""
                      }`}
                    >
                      <span className="grid grid-cols-2 gap-px bg-[#e5eaec]">
                        {option.items.slice(0, 4).map((item) => (
                          <span key={item.imageUrl} className="relative aspect-square bg-[#f6f7f7]">
                            <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
                          </span>
                        ))}
                      </span>
                      <span className="block px-3 py-2 text-[12.5px] font-semibold text-[#121821]">{option.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 rounded-[18px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
              <p className="text-[14px] font-semibold text-[#121821]">Want your own clothes and photo?</p>
              <p className="mt-1 text-[13px] text-[#4f5b66]">Create a free account to add your closet, use your photo and save looks.</p>
              <Link href="/login?create=1" className={`${btnPrimary} mt-4`}>
                Create a free account
              </Link>
            </div>
          </section>
        </div>
      </PageShell>
    </main>
  );
}
