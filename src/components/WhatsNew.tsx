"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LATEST_UPDATE } from "@/lib/whatsNew";
import { ArrowRightIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ui";

const NewPill = () => (
  <span className="inline-flex items-center rounded-full bg-[#d93a2b] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.6px] text-white">
    New
  </span>
);

/** A numbered step label. */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#121821] sm:text-[13.5px]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#121821] text-[11px] font-bold text-white">
        {n}
      </span>
      {children}
    </p>
  );
}

/** How it works, in four steps: the pieces picked, the full-body photo, and the real Virm try-on of them. */
function LayersVisual() {
  return (
    <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#e3ebf2,#c7d4e0_55%,#dfe3ee)] p-4 sm:p-6">
      <div className="mb-3 grid grid-cols-2 gap-3 sm:gap-4">
        <Step n={1}>Add your clothes</Step>
        <Step n={2}>Pick your pieces</Step>
      </div>
      <ol
        className="mb-5 grid grid-cols-4 gap-2 sm:gap-3"
        aria-label="Pieces picked"
      >
        {LATEST_UPDATE.pieces.map((piece) => (
          <li
            key={piece.src}
            className="flex flex-col items-center gap-1.5 rounded-[14px] bg-white/85 p-1.5 pb-2 shadow-[0_8px_20px_rgba(18,30,45,0.08)]"
          >
            <span className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-[#f4f5f6]">
              <Image
                src={piece.src}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            </span>
            <span className="text-center text-[10.5px] font-semibold leading-tight text-[#121821] sm:text-[11.5px]">
              {piece.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          {
            src: LATEST_UPDATE.photo,
            label: "Before",
            step: "Add a full-body photo",
            alt: "Full-body photo before the try-on",
          },
          {
            src: LATEST_UPDATE.after,
            label: "After",
            step: "Try it on",
            alt: "The same photo wearing the four pieces, made by Virm",
          },
        ].map((shot, i) => (
          <div key={shot.label} className="min-w-0">
            <div className="mb-3">
              <Step n={i + 3}>{shot.step}</Step>
            </div>
            <figure className="relative m-0 aspect-[3/5] overflow-hidden rounded-[20px] bg-[#e8e6e3] shadow-[0_14px_36px_rgba(18,30,45,0.12)]">
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                unoptimized
                className="object-cover object-top"
              />
              <figcaption
                className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.2px] ${
                  shot.label === "After"
                    ? "bg-[#121821] text-white"
                    : "bg-white/90 text-[#4f5b66]"
                }`}
              >
                {shot.label}
              </figcaption>
            </figure>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center">
        <Link href="/try" className={btnPrimary}>
          Try for fun <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/** Before logging in: a full section introducing the update. */
export function WhatsNewSection() {
  return (
    <section
      aria-labelledby="whats-new-title"
      className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pt-12 sm:px-8 lg:grid-cols-2 lg:gap-16"
    >
      <div>
        <NewPill />
        <h2
          id="whats-new-title"
          className="mt-4 font-display text-[40px] font-normal leading-[1.02] tracking-[-1px] text-[#121821] sm:text-[54px]"
        >
          {LATEST_UPDATE.title}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#4f5b66]">
          {LATEST_UPDATE.body}
        </p>
      </div>
      <LayersVisual />
    </section>
  );
}

/** After logging in: a short card that can be closed (remembered on this device). */
export function WhatsNewCard() {
  const key = `virm-closed-${LATEST_UPDATE.id}`;
  const [closed, setClosed] = useState(true);

  useEffect(() => {
    let wasClosed = false;
    try {
      wasClosed = localStorage.getItem(key) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading this device's choice after mount
    setClosed(wasClosed);
  }, [key]);

  if (closed) return null;

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }

  return (
    <section
      aria-label="What's new"
      className="relative mb-6 flex flex-col gap-4 overflow-hidden rounded-[22px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:flex-row sm:items-center sm:gap-6 sm:p-6"
    >
      <div className="flex shrink-0 -space-x-3">
        {LATEST_UPDATE.pieces.map((piece) => (
          <span
            key={piece.src}
            className="relative h-12 w-12 overflow-hidden rounded-full bg-[#f4f5f6] ring-2 ring-white"
          >
            <Image
              src={piece.src}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-[#121821]">
          <NewPill /> {LATEST_UPDATE.title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4f5b66]">
          {LATEST_UPDATE.body}
        </p>
      </div>
      <Link
        href="/studio"
        className={`${btnPrimary} shrink-0 self-start sm:self-auto`}
      >
        Try it in Studio
      </Link>
      <button
        onClick={close}
        aria-label="Close"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[16px] leading-none text-[#5d6874] hover:bg-[#f4f5f6] hover:text-[#121821]"
      >
        ×
      </button>
    </section>
  );
}
