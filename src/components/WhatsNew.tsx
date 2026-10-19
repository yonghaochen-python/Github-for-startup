"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LATEST_UPDATE } from "@/lib/whatsNew";
import { ArrowRightIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ui";

const NewPill = () => (
  <span className="inline-flex items-center rounded-full bg-[#d93a2b] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.6px] text-white">New</span>
);

/** The pieces stacked as layers beside a full-body photo: what Virm dresses, and what it dresses it on. */
function LayersVisual() {
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#e3ebf2,#c7d4e0_55%,#dfe3ee)] p-5 sm:gap-6 sm:p-8">
      <ol className="flex flex-col gap-2.5">
        {LATEST_UPDATE.pieces.map((piece, i) => (
          <li
            key={piece.src}
            className="flex items-center gap-3 rounded-[16px] bg-white/85 p-2 pr-3 shadow-[0_8px_20px_rgba(18,30,45,0.08)] backdrop-blur"
            style={{ marginLeft: `${i * 6}%` }}
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[11px] bg-[#f4f5f6] sm:h-14 sm:w-14">
              <Image src={piece.src} alt="" fill unoptimized className="object-cover" />
            </span>
            <span className="min-w-0 text-[11.5px] font-semibold text-[#121821] sm:text-[12.5px]">{piece.label}</span>
          </li>
        ))}
      </ol>
      <div className="relative mx-auto aspect-[3/5] w-full max-w-[220px] overflow-hidden rounded-[22px] bg-[#e8e6e3] shadow-[0_14px_36px_rgba(18,30,45,0.12)]">
        <Image src={LATEST_UPDATE.photo} alt="A full-body photo, standing and facing forward" fill unoptimized className="object-cover object-top" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#4f5b66]">Your photo</span>
      </div>
    </div>
  );
}

/** Before logging in: a full section introducing the update. */
export function WhatsNewSection() {
  return (
    <section aria-labelledby="whats-new-title" className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pt-20 sm:px-8 lg:grid-cols-2 lg:gap-16">
      <div>
        <NewPill />
        <h2 id="whats-new-title" className="mt-4 font-display text-[40px] font-normal leading-[1.02] tracking-[-1px] text-[#121821] sm:text-[54px]">
          {LATEST_UPDATE.title}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#4f5b66]">{LATEST_UPDATE.body}</p>
        <Link href="/login" className={`${btnPrimary} mt-7`}>
          Try it free <ArrowRightIcon className="h-4 w-4" />
        </Link>
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
    <section aria-label="What's new" className="relative mb-6 flex flex-col gap-4 overflow-hidden rounded-[22px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="flex shrink-0 -space-x-3">
        {LATEST_UPDATE.pieces.map((piece) => (
          <span key={piece.src} className="relative h-12 w-12 overflow-hidden rounded-full bg-[#f4f5f6] ring-2 ring-white">
            <Image src={piece.src} alt="" fill unoptimized className="object-cover" />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-[#121821]">
          <NewPill /> {LATEST_UPDATE.title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4f5b66]">{LATEST_UPDATE.body}</p>
      </div>
      <Link href="/studio" className={`${btnPrimary} shrink-0 self-start sm:self-auto`}>
        Try it in Studio
      </Link>
      <button
        onClick={close}
        aria-label="Close"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[16px] leading-none text-[#6b7783] hover:bg-[#f4f5f6] hover:text-[#121821]"
      >
        ×
      </button>
    </section>
  );
}
