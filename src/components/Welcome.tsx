"use client";

import Link from "next/link";
import Image from "next/image";
import { GUEST_LOOKS } from "@/lib/guestLooks";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { ArrowRightIcon } from "@/components/Icons";

/** The look on the signed-out hero, and the ones in the strip under it (all made in advance for the free demo). */
const HERO_LOOK = GUEST_LOOKS.find((l) => l.slug === "autumn-layers")!;
const STRIP_LOOKS = ["garden-party", "office-winter", "beach-day", "camel-and-cream"]
  .map((slug) => GUEST_LOOKS.find((l) => l.slug === slug))
  .filter((l): l is (typeof GUEST_LOOKS)[number] => Boolean(l));

/**
 * Signed out: what Virm does, shown rather than told. A look's pieces numbered beside the model wearing them (the
 * Studio mirror in miniature), then a few more looks. Every picture is from the free demo; nothing personal is read.
 */
/**
 * Signed out: what Virm does, shown rather than told. A look's pieces numbered beside the model wearing them (the
 * Studio mirror in miniature), then a few more looks. Every picture is from the free demo; nothing personal is read.
 */
export function Welcome() {
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
