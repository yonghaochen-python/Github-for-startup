"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GUEST_MODEL_PHOTO } from "@/lib/guestLooks";
import { LandingHero, SourceTag, samplePiece } from "@/components/landing/LandingHero";

/**
 * Landing A — shopping, with the female demo model: pieces from "Your store" tried on with "Your closet". Pick a
 * store piece and the picture sweeps from her photo to the try-on; the closet pieces that look uses light up. Drag
 * the picture to compare before and after. Every picture is a real try-on made in advance (no AI per visit).
 */
const YOURS = ["turtleneck", "plaid-skirt", "knee-boots"].map(samplePiece);
const STORE = [
  { piece: samplePiece("camel-coat"), picture: "/guest-looks/autumn-layers.jpg", uses: ["turtleneck", "plaid-skirt", "knee-boots"] },
  // Made for this page (one try-on, then untucked with a FLUX 3 edit): the puffer with her same skirt and boots.
  { piece: samplePiece("puffer-jacket"), picture: "/landing/women/puffer-plaid.jpg", uses: ["turtleneck", "plaid-skirt", "knee-boots"] },
  { piece: samplePiece("cable-sweater"), picture: "/guest-looks/plaid-and-knit.jpg", uses: ["plaid-skirt", "knee-boots"] },
];

export function LandingShop() {
  const [pick, setPick] = useState(0);
  const [pos, setPos] = useState(50);
  const [sweeping, setSweeping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const look = STORE[pick];

  /** Show the chosen piece: start on her photo, then sweep to the try-on. */
  function choose(i: number) {
    setPick(i);
    setSweeping(false);
    setPos(100);
    if (timer.current) clearTimeout(timer.current);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setSweeping(true);
        setPos(0);
        timer.current = setTimeout(() => setSweeping(false), 1100);
      })
    );
  }

  return (
    <LandingHero
      title={
        <>
          Before you buy it, <em className="text-[#2b4560]">see how it works with everything you already own.</em>
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
        {/* Where each piece comes from: the store (tap to try it) and the closet. */}
        <div className="flex flex-col justify-center gap-4">
          <div className="flex flex-col gap-2 rounded-[8px] bg-white p-2 shadow-[0_14px_32px_rgba(18,30,45,0.1)]">
            <SourceTag kind="store" />
            {STORE.map((s, i) => (
              <button
                key={s.piece.name}
                onClick={() => choose(i)}
                aria-pressed={pick === i}
                aria-label={`Try the ${s.piece.description.toLowerCase()} with my clothes`}
                className={`relative aspect-square w-full overflow-hidden rounded-[6px] bg-[#f5f3ef] transition ${
                  pick === i ? "opacity-100 ring-2 ring-[#121821]" : "opacity-55 hover:opacity-85"
                }`}
              >
                <Image src={s.piece.imageUrl} alt="" fill unoptimized className="object-cover" />
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-[12px] bg-[#efe4d6] p-2 shadow-[inset_0_0_0_1px_rgba(138,106,72,0.25)]">
            <SourceTag kind="closet" />
            {YOURS.map((p) => (
              <span
                key={p.name}
                className={`relative aspect-square w-full overflow-hidden rounded-[8px] bg-white transition-opacity duration-300 ${look.uses.includes(p.name) ? "" : "opacity-30"}`}
              >
                <Image src={p.imageUrl} alt={`${p.description} (from your closet)`} fill unoptimized className="object-cover" />
              </span>
            ))}
          </div>
        </div>

        {/* Before and after, in the live page's arch. Drag to compare. */}
        <div className="relative aspect-[3/5] self-center overflow-hidden rounded-b-[28px] rounded-t-[999px] bg-[#eceae6] shadow-[0_40px_90px_rgba(18,30,45,0.18)]">
          <Image src={look.picture} alt={`The ${look.piece.description.toLowerCase()} worn with her own clothes`} fill priority unoptimized className="object-cover" />
          <Image
            src={GUEST_MODEL_PHOTO}
            alt="Her photo before the try-on"
            fill
            unoptimized
            className={`object-cover ${sweeping ? "transition-[clip-path] duration-1000 ease-[cubic-bezier(.6,0,.2,1)]" : ""}`}
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white ${sweeping ? "transition-[left] duration-1000 ease-[cubic-bezier(.6,0,.2,1)]" : ""}`}
            style={{ left: `${pos}%` }}
          >
            <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[13px] font-bold text-[#121821] shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
              ‹ ›
            </span>
          </span>
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#121821]">Before</span>
          <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#121821]">After</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => {
              setSweeping(false);
              setPos(Number(e.target.value));
            }}
            aria-label="Compare her photo with the try-on"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      </div>
    </LandingHero>
  );
}
