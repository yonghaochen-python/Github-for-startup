"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LandingHero, SourceTag, samplePiece } from "@/components/landing/LandingHero";

/**
 * Landing B — your wardrobe, with the male model: his own closet beside him and outfits for real days. Tap a piece or
 * an occasion to see an outfit made from it; the pieces it uses light up. Cycles on its own until the first tap.
 * No pieces from page A's store (camel coat, puffer), so the two pages don't overlap. Every picture is a real try-on
 * made in advance (a stock photo of a man; the turtleneck look is his sweater picture changed with a FLUX 3 edit).
 */
const CLOSET = ["turtleneck", "cable-sweater", "linen-shirt", "wool-trousers", "light-jeans", "chelsea-boots", "white-sneakers"].map(samplePiece);
const LOOKS = [
  { name: "Workday", picture: "/landing/men/turtleneck.jpg", uses: ["turtleneck", "wool-trousers", "chelsea-boots"] },
  { name: "Weekend", picture: "/landing/men/cable-sweater.jpg", uses: ["cable-sweater", "wool-trousers", "chelsea-boots"] },
  { name: "Sunny day", picture: "/landing/men/linen-shirt.jpg", uses: ["linen-shirt", "light-jeans", "white-sneakers"] },
];

export function LandingWardrobe() {
  const [k, setK] = useState(0);
  const [touched, setTouched] = useState(false);
  const look = LOOKS[k];

  // Show each outfit in turn until someone taps.
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setK((n) => (n + 1) % LOOKS.length), 2800);
    return () => clearInterval(id);
  }, [touched]);

  /** The next outfit (after this one) made with this piece. */
  function pickPiece(name: string) {
    setTouched(true);
    for (let step = 1; step <= LOOKS.length; step++) {
      const i = (k + step) % LOOKS.length;
      if (LOOKS[i].uses.includes(name)) return setK(i);
    }
  }

  return (
    <LandingHero
      title={
        <>
          Your closet has more outfits in it <em className="text-[#2b4560]">than you think.</em>
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
        {/* His closet: tap a piece for an outfit made with it. */}
        <div className="flex flex-col justify-center gap-2 self-center rounded-[12px] bg-[#efe4d6] p-2 shadow-[inset_0_0_0_1px_rgba(138,106,72,0.25)]">
          <SourceTag kind="closet" />
          <div className="grid grid-cols-2 gap-1.5">
            {CLOSET.map((p) => {
              const on = look.uses.includes(p.name);
              return (
                <button
                  key={p.name}
                  onClick={() => pickPiece(p.name)}
                  aria-pressed={on}
                  aria-label={`An outfit with the ${p.description.toLowerCase()}`}
                  className={`relative aspect-square w-full overflow-hidden rounded-[8px] bg-white transition duration-300 ${on ? "ring-2 ring-[#121821]" : "opacity-40 hover:opacity-80"}`}
                >
                  <Image src={p.imageUrl} alt="" fill unoptimized className="object-cover" />
                </button>
              );
            })}
          </div>
        </div>

        {/* The outfit on him, in the live page's arch, with the occasions under it. */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative aspect-[3/5] w-full overflow-hidden rounded-b-[28px] rounded-t-[999px] bg-[#eceae6] shadow-[0_40px_90px_rgba(18,30,45,0.18)]">
            {LOOKS.map((l, i) => (
              <Image
                key={l.picture}
                src={l.picture}
                alt={i === k ? `His ${l.name.toLowerCase()} outfit from his own closet` : ""}
                fill
                priority={i === 0}
                unoptimized
                className={`object-cover transition-opacity duration-700 ${i === k ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </div>
          <div role="radiogroup" aria-label="Pick an occasion" className="flex flex-wrap justify-center gap-2">
            {LOOKS.map((l, i) => (
              <button
                key={l.name}
                role="radio"
                aria-checked={i === k}
                onClick={() => {
                  setTouched(true);
                  setK(i);
                }}
                className={`min-h-[36px] rounded-full px-4 text-[13px] font-medium transition-colors ${
                  i === k ? "bg-[#121821] text-white" : "bg-white text-[#4f5b66] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:text-[#121821]"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </LandingHero>
  );
}
