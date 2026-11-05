"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MirrorIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { Checklist, Cover, Panel, Stars, Thumb, VerdictRow, Why, shortDay, useRecolored } from "@/components/studio/board";
import type { StyledPiece } from "@/lib/closetLook";
import type { StudioModule, StudioReportData } from "@/lib/studioModules";
import { topPicks } from "@/lib/studioPicks";
import { JEWELRY_INFO, type JewelryRating, type StyleExtra } from "@/lib/studioStyle";

type ClosetItem = { id: string; imageUrl: string; category: string; description: string };
const STARS: Record<JewelryRating, number> = { recommended: 5, alternative: 3, less: 1 };

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
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
        {look.pieces.map((piece) => {
          const item = byId.get(piece.itemId);
          if (!item) return null;
          return (
            <li key={piece.itemId} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-[12px] bg-[#f4f6f8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.description} className={`h-full w-full ${item.imageUrl.startsWith("/uploads/cut-") ? "object-contain p-1.5" : "object-cover"}`} />
                <div className="absolute right-1 top-1 flex gap-1">
                  {piece.alternates.length > 0 && (
                    <button onClick={() => swap(piece)} aria-label={`Swap ${item.description} for another`} title="Swap" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[12px] shadow">
                      ↻
                    </button>
                  )}
                  <button onClick={() => takeOut(piece)} aria-label={`Take out ${item.description}`} title="Take out" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[11px] shadow">
                    ✕
                  </button>
                </div>
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-[#2b3540]" title={item.description}>
                {item.description}
              </p>
            </li>
          );
        })}
      </ul>
      {ids.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/studio?items=${ids.join(",")}`} className={btnPrimary}>
            Try it on
          </Link>
          <Link href={`/studio?items=${ids.join(",")}&mode=live`} className={btnSecondary}>
            <MirrorIcon className="h-4 w-4" /> See it live
          </Link>
        </div>
      )}
      <Why text={look.rationale} />
    </>
  );
}

/** The Personal Style Guide as a board: verdict, top colors ✓ / ○ / ✗ on your photo, jewelry stars, closet look. */
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
  const rows = [
    ["yes", x.topColors.recommended],
    ["ok", x.topColors.neutral],
    ["no", x.topColors.lessHarmonious],
  ] as const;
  const { pictures, of } = useRecolored(portrait, rows.flatMap(([, list]) => list.map((s) => s.hex)), "top");
  const main = x.directions[0];

  return (
    <div className="flex flex-col gap-4">
      <Cover
        module={module}
        portrait={portrait}
        date={shortDay(createdAt)}
        banner={{
          label: "Your style",
          value: main?.name ?? data.headline,
          line: x.directions.length > 1 ? `Also suits you: ${x.directions.slice(1).map((d) => d.name).join(", ")}` : undefined,
        }}
        keywords={data.keywords}
        picks={topPicks("style", data).slice(1)}
        after={x.topColors.recommended[0] ? { src: of(x.topColors.recommended[0].hex), label: `In ${x.topColors.recommended[0].name}` } : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel module={module} title="Top colors on you" note={pictures === null ? "shown as colors (your top wasn't found)" : undefined}>
          <div className="flex flex-col gap-4">
            {rows.map(([verdict, list]) =>
              list.length ? (
                <VerdictRow key={verdict} verdict={verdict}>
                  {list.map((s) => (
                    <Thumb key={s.hex + s.name} image={of(s.hex)} color={s.hex} label={s.name} />
                  ))}
                </VerdictRow>
              ) : null
            )}
          </div>
          <Why text={x.colorNotes} />
        </Panel>

        <Panel module={module} title="Jewelry">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {[...x.jewelry]
              .sort((a, b) => STARS[b.rating] - STARS[a.rating])
              .map((j) => (
                <li key={j.material} className={`flex flex-col items-center rounded-[14px] bg-[#f6f7f8] px-2 py-3 text-center ${j.rating === "less" ? "opacity-60" : ""}`}>
                  <span className="h-9 w-9 rounded-full shadow-[0_3px_8px_rgba(18,24,33,0.18)]" style={{ background: JEWELRY_INFO[j.material].finish }} />
                  <span className="mt-2 text-[12.5px] font-semibold text-[#121821]">{JEWELRY_INFO[j.material].name}</span>
                  <Stars n={STARS[j.rating]} />
                </li>
              ))}
          </ul>
          <Why text={x.jewelryDirection} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {x.look && x.look.pieces.length > 0 && (
          <Panel module={module} title="From your closet" note="↻ swap · ✕ take out">
            <ClosetLook look={x.look} onChange={onLookChange} />
          </Panel>
        )}
        <Panel module={module} title="Your style plan">
          <Checklist module={module} items={[x.overall.colorFamilies, x.overall.aesthetic, x.overall.wardrobe]} />
          <Why text={x.directions.map((d) => `${d.name}: ${d.why}`).join(" ")} label="Why these styles?" />
          <p className="mt-4 text-[11px] text-[#8a939c]">
            Confidence: {data.confidence}
            {data.limits ? ` · ${data.limits}` : ""}
          </p>
        </Panel>
      </div>
    </div>
  );
}
