"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OutfitCard, type Outfit } from "@/components/OutfitCard";
import { InlineLoading } from "@/components/InlineLoading";

export default function SavedLooksPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function loadOutfits() {
    try {
      const res = await fetch("/api/outfits");
      if (res.status === 401) {
        setSignedOut(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load outfits");
      const data = (await res.json()) as { outfits?: Outfit[] };
      setOutfits(data.outfits ?? []);
      setLoadError(false);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/outfits")
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 401) {
          setSignedOut(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load outfits");
        const data = (await res.json()) as { outfits?: Outfit[] };
        if (ignore) return;
        setOutfits(data.outfits ?? []);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const saved = outfits.filter((o) => o.isFavorite);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-14 sm:px-8">
      <div className="mb-14">
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">The ones you love</p>
        <h1
          className="font-display mt-3 font-normal tracking-[-2px] text-[#1c2328]"
          style={{ fontSize: "clamp(40px, 5vw, 60px)" }}
        >
          Saved Looks
        </h1>
      </div>

      {loading ? (
        <InlineLoading />
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
            className="btn-tactile rounded-[5px] bg-[#242b30] px-6 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_4px_14px_#222d3422] hover:bg-[#3b4750]"
          >
            Explore outfits
          </Link>
        </div>
      ) : (
        <div className="grid gap-[32px_24px] sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>
      )}
    </main>
  );
}
