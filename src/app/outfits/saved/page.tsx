"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LayeringRole } from "@/lib/layering";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";
import { LoadingScreen } from "@/components/LoadingScreen";
import { afterMinDelay } from "@/lib/minDelay";

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

export default function SavedLooksPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function loadOutfits() {
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/outfits");
      if (res.status === 401) {
        afterMinDelay(startedAt, 500, () => {
          setSignedOut(true);
          setLoading(false);
        });
        return;
      }
      if (!res.ok) throw new Error("Failed to load outfits");
      const data = (await res.json()) as { outfits?: Outfit[] };
      afterMinDelay(startedAt, 500, () => {
        setOutfits(data.outfits ?? []);
        setLoadError(false);
        setLoading(false);
      });
    } catch {
      afterMinDelay(startedAt, 500, () => {
        setLoadError(true);
        setLoading(false);
      });
    }
  }

  useEffect(() => {
    let ignore = false;
    const startedAt = Date.now();
    fetch("/api/outfits")
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 401) {
          afterMinDelay(startedAt, 500, () => {
            if (ignore) return;
            setSignedOut(true);
            setLoading(false);
          });
          return;
        }
        if (!res.ok) throw new Error("Failed to load outfits");
        const data = (await res.json()) as { outfits?: Outfit[] };
        afterMinDelay(startedAt, 500, () => {
          if (ignore) return;
          setOutfits(data.outfits ?? []);
          setLoadError(false);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!ignore) {
          afterMinDelay(startedAt, 500, () => {
            if (ignore) return;
            setLoadError(true);
            setLoading(false);
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const saved = outfits.filter((o) => o.isFavorite);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-10 sm:px-8">
      <div className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">The ones you love</p>
        <h1 className="font-display mt-2 text-4xl font-normal tracking-[-2px] text-[#222a2f] sm:text-5xl">
          Saved Looks
        </h1>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-red-700">Couldn&apos;t load your saved looks. Please try again.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadOutfits();
            }}
            className="rounded-[5px] border border-[#cbd3d7] px-4 py-1.5 text-sm font-medium text-[#333f46] hover:bg-[#e9edef]"
          >
            Try again
          </button>
        </div>
      ) : signedOut ? (
        <p className="text-sm text-[#89949a]">
          <Link href="/login" className="text-[#354134] hover:underline">
            Log in
          </Link>{" "}
          to see your saved looks.
        </p>
      ) : saved.length === 0 ? (
        <div className="flex max-w-[420px] flex-col items-start gap-4 py-10">
          <h3 className="font-display text-[37px] font-normal leading-tight text-[#30392f]">
            A place for your favorites.
          </h3>
          <p className="text-[13px] leading-relaxed text-[#888f84]">
            Save looks you love and find them here whenever you need a little inspiration.
          </p>
          <Link
            href="/outfits"
            className="rounded-[5px] bg-[#242b30] px-5 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750]"
          >
            Explore outfits
          </Link>
        </div>
      ) : (
        <div className="grid gap-[27px_22px] sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((outfit) => (
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
                  <h2 className="text-sm font-bold uppercase tracking-[-0.15px] text-[#222a2f]">Look</h2>
                </div>
                <span className="shrink-0 text-xs text-[#354134]">★</span>
              </div>
              <div className="overflow-hidden bg-white">
                <EditorialOutfitVisual items={outfit.layers.flatMap((layer) => layer.items)} />
              </div>
              <div className="px-4 py-4">
                <p className="text-sm text-[#737d82]">{outfit.rationale}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
