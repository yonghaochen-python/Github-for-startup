"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MirrorIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary } from "@/components/ui";
import type { StyledPiece } from "@/lib/closetLook";
import type { NotedSwatch } from "@/lib/studioColor";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";
import { JEWELRY_INFO, type JewelryRating, type StyleExtra } from "@/lib/studioStyle";
import { recolorTop, type Recolored } from "@/lib/topRecolor";

const label = "text-[11px] font-medium uppercase tracking-[2.6px] text-[#5d6874]";
const longDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
type ClosetItem = { id: string; imageUrl: string; category: string; description: string };

const RATINGS: { rating: JewelryRating; title: string }[] = [
  { rating: "recommended", title: "Recommended" },
  { rating: "alternative", title: "Alternatives" },
  { rating: "less", title: "Less preferred" },
];

/** The same portrait in each top color, made on this device (only the top changes). */
function TopColors({ portrait, groups, notes }: { portrait: string | null; groups: StyleExtra["topColors"]; notes: string }) {
  const all: { group: string; swatch: NotedSwatch }[] = [
    ...groups.recommended.map((swatch) => ({ group: "Recommended", swatch })),
    ...groups.neutral.map((swatch) => ({ group: "Neutral", swatch })),
    ...groups.lessHarmonious.map((swatch) => ({ group: "Less harmony", swatch })),
  ];
  const [pictures, setPictures] = useState<Recolored[] | null | undefined>(undefined);
  const colors = all.map((a) => a.swatch.hex).join();

  useEffect(() => {
    if (!portrait || !colors) return;
    let made: Recolored[] = [];
    let live = true;
    recolorTop(portrait, colors.split(","))
      .then((result) => {
        made = result ?? [];
        if (live) setPictures(result);
      })
      .catch(() => live && setPictures(null));
    return () => {
      live = false;
      made.forEach((m) => URL.revokeObjectURL(m.url));
    };
  }, [portrait, colors]);

  return (
    <section className="px-7 py-10 sm:px-12">
      <p className={`${label} mb-2`}>Top colors, side by side</p>
      <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-[#4f5b66]">{notes}</p>
      {pictures === null && <p className="mb-4 text-[12.5px] text-[#5d6874]">Your top couldn&apos;t be found clearly in this portrait, so the colors are shown as swatches.</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {all.map(({ group, swatch }, i) => {
          const pic = pictures?.[i];
          return (
            <li key={`${group}${swatch.hex}`}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[16px]" style={{ background: swatch.hex }}>
                {pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pic.url} alt={`You in a ${swatch.name} top`} className="h-full w-full object-cover" />
                ) : (
                  pictures === undefined && portrait && <div className="absolute inset-0 animate-pulse bg-white/30" />
                )}
              </div>
              <p className={`mt-2.5 text-[10.5px] font-medium uppercase tracking-[1.8px] ${group === "Less harmony" ? "text-[#a3533f]" : "text-[#5d6874]"}`}>{group}</p>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#121821]">
                <span className="h-3 w-3 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.15)]" style={{ background: swatch.hex }} />
                {swatch.name}
              </p>
              <p className="text-[11px] uppercase tracking-[1px] text-[#5d6874]">{swatch.hex}</p>
              {swatch.note && <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">{swatch.note}</p>}
            </li>
          );
        })}
      </ul>
      {pictures && <p className="mt-4 text-[11.5px] text-[#5d6874]">Made on your device by recoloring only your top; the shade is approximate.</p>}
    </section>
  );
}

/** The look from their closet: swap or take out a piece, then try it on. */
function ClosetLook({ look, onChange }: { look: NonNullable<StyleExtra["look"]>; onChange: (pieces: StyledPiece[]) => void }) {
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  useEffect(() => {
    fetch("/api/closet/items")
      .then(async (res) => (res.ok ? (((await res.json()) as { items?: ClosetItem[] }).items ?? []) : []))
      .then(setCloset)
      .catch(() => {});
  }, []);
  const byId = new Map(closet.map((i) => [i.id, i]));
  const ids = look.pieces.map((p) => p.itemId).filter((id) => byId.has(id));

  const swap = (piece: StyledPiece) =>
    onChange(look.pieces.map((p) => (p.itemId === piece.itemId ? { itemId: piece.alternates[0], why: "", alternates: [...piece.alternates.slice(1), piece.itemId] } : p)));
  const takeOut = (piece: StyledPiece) => onChange(look.pieces.filter((p) => p.itemId !== piece.itemId));

  return (
    <section className="px-7 py-10 sm:px-12">
      <p className={`${label} mb-2`}>From your closet</p>
      {look.rationale && <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-[#4f5b66]">{look.rationale}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {look.pieces.map((piece) => {
          const item = byId.get(piece.itemId);
          if (!item) return null;
          return (
            <li key={piece.itemId} className="flex flex-col rounded-[16px] bg-[#f4f6f8] p-2">
              <div className="relative aspect-square overflow-hidden rounded-[12px] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.description} className={`h-full w-full ${item.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-2" : "object-cover"}`} />
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  {piece.alternates.length > 0 && (
                    <button onClick={() => swap(piece)} aria-label={`Swap ${item.description} for another`} title="Swap" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[14px] shadow hover:bg-white">
                      ↻
                    </button>
                  )}
                  <button onClick={() => takeOut(piece)} aria-label={`Take out ${item.description}`} title="Take out" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[13px] shadow hover:bg-white">
                    ✕
                  </button>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 px-1 text-[12px] font-semibold leading-snug text-[#121821]">{item.description}</p>
              {piece.why && <p className="mt-1 px-1 text-[11.5px] leading-snug text-[#5d6874]">{piece.why}</p>}
            </li>
          );
        })}
      </ul>
      {ids.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/studio?items=${ids.join(",")}`} className={btnPrimary}>
            Try it on
          </Link>
          <Link href={`/studio?items=${ids.join(",")}&mode=live`} className={btnSecondary}>
            <MirrorIcon className="h-4 w-4" /> See it live
          </Link>
        </div>
      )}
    </section>
  );
}

/** The Personal Style Guide report, laid out like a magazine feature. */
export function StyleReport({
  module,
  data,
  portrait,
  createdAt,
  onLookChange,
}: {
  module: StudioModule;
  data: StudioReportData;
  portrait: string | null;
  createdAt: string;
  onLookChange: (pieces: StyledPiece[]) => void;
}) {
  const x = data.extra as StyleExtra;
  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(18,30,45,0.1)]">
      {/* Cover */}
      <header className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ background: module.tint }}>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[2.6px]" style={{ color: module.accent }}>
            AI Stylist · {module.label} · {longDay(createdAt)}
          </p>
          {x.directions[0] && <p className="mt-8 font-display text-[22px] italic text-[#4f5b66]">{x.directions[0].name}</p>}
          <h2 className="mt-1 font-display text-[46px] font-normal leading-[1] tracking-[-1px] text-[#121821] sm:text-[64px]">{data.headline}</h2>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
            {data.keywords.map((k) => (
              <li key={k} className="text-[11.5px] font-medium uppercase tracking-[2px] text-[#4f5b66]">
                {k}
              </li>
            ))}
          </ul>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-[#2b3540]">{data.summary}</p>
        </div>
        <div className="mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-t-[14px] bg-white/60">
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="Your portrait" className="h-full w-full object-cover" />
          )}
        </div>
      </header>

      {/* Style directions */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-6`}>Style directions</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {x.directions.map((d) => (
            <li key={d.name} className={`rounded-[20px] p-5 ${d.primary ? "bg-[#121821] text-white" : "bg-[#f6f7f8] text-[#121821]"}`}>
              <p className={`text-[10.5px] uppercase tracking-[1.8px] ${d.primary ? "text-white/60" : "text-[#5d6874]"}`}>{d.primary ? "Your direction" : "Also suits you"}</p>
              <h3 className="mt-2 font-display text-[28px] leading-none">{d.name}</h3>
              <p className={`mt-3 text-[12.5px] leading-snug ${d.primary ? "text-white/80" : "text-[#4f5b66]"}`}>{d.why}</p>
              <p className={`mt-3 text-[10.5px] uppercase tracking-[1.6px] ${d.primary ? "text-white/60" : "text-[#5d6874]"}`}>{d.keywords.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </section>

      <div style={{ background: `linear-gradient(180deg, #fff, ${module.tint})` }}>
        <TopColors portrait={portrait} groups={x.topColors} notes={x.colorNotes} />
      </div>

      {/* Jewelry */}
      <section className="px-7 py-10 sm:px-12">
        <p className={`${label} mb-2`}>Jewelry and accessories</p>
        <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-[#4f5b66]">{x.jewelryDirection}</p>
        <div className="grid gap-8 md:grid-cols-3">
          {RATINGS.map(({ rating, title }) => {
            const list = x.jewelry.filter((j) => j.rating === rating);
            if (!list.length) return null;
            return (
              <div key={rating}>
                <p className="mb-4 font-display text-[24px] leading-none text-[#121821]">{title}</p>
                <ul className="space-y-4">
                  {list.map((j) => (
                    <li key={j.material} className="flex gap-3">
                      <span className={`mt-0.5 h-10 w-10 shrink-0 rounded-full shadow-[0_3px_8px_rgba(18,24,33,0.18)] ${rating === "less" ? "opacity-60" : ""}`} style={{ background: JEWELRY_INFO[j.material].finish }} />
                      <span>
                        <span className="block text-[13.5px] font-semibold text-[#121821]">{JEWELRY_INFO[j.material].name}</span>
                        <span className="block text-[12.5px] leading-snug text-[#5d6874]">{j.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {x.look && x.look.pieces.length > 0 && (
        <div className="border-t border-[#eef1f4]">
          <ClosetLook look={x.look} onChange={onLookChange} />
        </div>
      )}

      {/* Overall */}
      <section className="grid gap-x-12 gap-y-8 px-7 py-10 sm:px-12 md:grid-cols-2" style={{ background: module.tint }}>
        {(
          [
            ["Color families", x.overall.colorFamilies],
            ["Jewelry direction", x.jewelryDirection],
            ["Overall aesthetic", x.overall.aesthetic],
            ["Wardrobe direction", x.overall.wardrobe],
          ] as const
        ).map(([title, body]) => (
          <div key={title}>
            <h3 className="font-display text-[26px] leading-tight text-[#121821]">{title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#4f5b66]">{body}</p>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 px-7 py-6 text-[11.5px] text-[#5d6874] sm:px-12">
        <span>
          Confidence: <span className="font-semibold text-[#121821]">{data.confidence}</span>
          {data.limits ? ` · ${data.limits}` : ""}
        </span>
        <span>A styling suggestion from one photo and your closet, not a personality assessment.</span>
      </footer>
    </article>
  );
}
