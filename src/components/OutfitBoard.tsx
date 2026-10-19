"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Outfit } from "@/components/OutfitCard";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";
import { MirrorIcon } from "@/components/Icons";
import { SaveToggle } from "@/components/SaveToggle";
import { useToast } from "@/components/Toast";
import { LAYER_LABELS } from "@/lib/layering";
import { btnPrimary } from "@/components/ui";

/**
 * A generated or saved outfit as a visual board with its pieces labeled, and the three things people do
 * next: try it on (straight into the try-on screen with this outfit loaded), save it, or open its details.
 */
export function OutfitBoard({
  outfit,
  onSavedChange,
  showTryOn = false,
}: {
  outfit: Outfit;
  onSavedChange?: (outfit: Outfit) => void;
  /** Show the person wearing it (their latest try-on of this outfit) when there is one. */
  showTryOn?: boolean;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const items = outfit.layers.flatMap((layer) => layer.items);

  async function setFavorite(isFavorite: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error();
      onSavedChange?.({ ...outfit, isFavorite });
      showToast(isFavorite ? "Saved" : "Unsaved");
    } catch {
      showToast("Couldn't update that look. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[1.8px] text-[#8b969c]">{outfit.occasion ?? "Outfit"}</p>
          <h3 className="font-display text-[24px] font-normal leading-tight text-[#121821]">
            {items.length}-piece look
          </h3>
        </div>
        <SaveToggle saved={outfit.isFavorite} busy={saving} onToggle={() => setFavorite(!outfit.isFavorite)} />
      </header>

      <Link href={`/outfits/${outfit.id}`} aria-label="View outfit details" className="block bg-[#f5f6f4]">
        {showTryOn && outfit.tryOn ? (
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-px bg-black/[0.05] sm:grid-cols-[minmax(0,1fr)_100px]">
            <div className="relative aspect-[3/4] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
              <img
                src={`/api/outfits/${outfit.id}/try-on/image?v=${outfit.tryOn}`}
                alt="You wearing this look"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <div className="grid auto-rows-fr gap-px">
              {items.slice(0, 5).map((item) => (
                <div key={item.id} className="relative min-h-[64px] bg-white">
                  <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-contain p-1.5" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EditorialOutfitVisual items={items} />
        )}
      </Link>

      <ol className="grid min-w-0 grid-cols-1 gap-1 border-t border-black/[0.06] px-5 py-4 text-[12px] text-[#3b4850]">
        {items.map((item, i) => (
          <li key={item.id} className="flex min-w-0 gap-2">
            <span className="w-5 shrink-0 text-[10px] font-bold text-[#8b969c]">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 truncate">{item.description}</span>
            <span className="ml-auto shrink-0 text-[10.5px] text-[#8b969c]">{LAYER_LABELS[item.layeringRole] ?? ""}</span>
          </li>
        ))}
      </ol>

      {outfit.rationale && <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-[#4f5b66]">{outfit.rationale}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-black/[0.06] px-5 py-4">
        <Link href={`/studio?outfit=${outfit.id}&start=1`} className={btnPrimary}>
          <MirrorIcon className="h-4 w-4" /> Try On
        </Link>
        <Link href={`/outfits/${outfit.id}`} className="min-h-[44px] px-1 py-3 text-[12.5px] font-semibold text-[#26313a] underline-offset-4 hover:underline">
          View Look
        </Link>
      </div>
    </article>
  );
}

/** Placeholder boards shown while the stylist is working. */
export function OutfitBoardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse overflow-hidden rounded-[18px] bg-white">
      <div className="space-y-2 px-5 py-4">
        <div className="h-2 w-16 bg-[#e5eaec]" />
        <div className="h-5 w-32 bg-[#e5eaec]" />
      </div>
      <div className="h-[320px] bg-[#f0f3f4]" />
      <div className="space-y-2 px-5 py-4">
        <div className="h-3 w-full bg-[#eef1f2]" />
        <div className="h-3 w-4/5 bg-[#eef1f2]" />
      </div>
    </div>
  );
}
