"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  color: string;
  material: string;
  description: string;
};

type Outfit = {
  id: string;
  rationale: string;
  isFavorite: boolean;
  occasion: string | null;
  weather: string | null;
  style: string | null;
  items: ClothingItem[];
};

export default function OutfitDetailPage() {
  const params = useParams<{ id: string }>();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [closet, setCloset] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/outfits/${params.id}`).then(async (res) => {
      if (ignore) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { outfit: Outfit };
      setOutfit(data.outfit);
      setLoading(false);
    });
    fetch("/api/closet/items").then(async (res) => {
      if (ignore || !res.ok) return;
      const data = (await res.json()) as { items?: ClothingItem[] };
      setCloset(data.items ?? []);
    });
    return () => {
      ignore = true;
    };
  }, [params.id]);

  async function toggleFavorite() {
    if (!outfit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !outfit.isFavorite }),
      });
      const data = (await res.json()) as { outfit?: Outfit };
      if (data.outfit) setOutfit(data.outfit);
    } finally {
      setSaving(false);
    }
  }

  async function confirmSwap(removeItemId: string) {
    if (!outfit || !replacementId) return;
    setSwapping(true);
    setError(null);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItemId, addItemId: replacementId }),
      });
      const data = (await res.json()) as { error?: string; outfit?: Outfit };
      if (!res.ok || !data.outfit) throw new Error(data.error ?? "Couldn't change that item");
      setOutfit(data.outfit);
      setSwappingId(null);
      setReplacementId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that item");
    } finally {
      setSwapping(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (notFound || !outfit) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm text-zinc-500">
          Outfit not found. Back to{" "}
          <Link href="/outfits" className="text-blue-600 hover:underline dark:text-blue-400">
            outfits
          </Link>
          .
        </p>
      </main>
    );
  }

  const usedIds = new Set(outfit.items.map((i) => i.id));
  const replacementOptions = closet.filter((i) => !usedIds.has(i.id));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/outfits" className="mb-4 inline-block text-sm text-zinc-500 hover:underline">
        ← Back to outfits
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {outfit.occasion && (
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
            {outfit.occasion}
          </span>
        )}
        {outfit.weather && (
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
            {outfit.weather}
          </span>
        )}
        {outfit.style && (
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
            {outfit.style}
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {outfit.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-950">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
              <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
            </div>
            <p className="mt-2 text-xs font-medium">{item.description}</p>
            <p className="text-xs text-zinc-500">
              {item.color} · {item.material}
            </p>
            {swappingId === item.id ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <select
                  value={replacementId}
                  onChange={(e) => setReplacementId(e.target.value)}
                  className="rounded border border-black/15 bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-zinc-900"
                >
                  <option value="">Choose replacement…</option>
                  {replacementOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.description}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => confirmSwap(item.id)}
                    disabled={!replacementId || swapping}
                    className="flex-1 rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {swapping ? "…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => {
                      setSwappingId(null);
                      setReplacementId("");
                    }}
                    className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSwappingId(item.id)}
                className="mt-2 text-xs text-zinc-500 hover:underline"
              >
                Swap
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Why it works</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{outfit.rationale}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/outfits/${outfit.id}/try-on`}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Try It On
        </Link>
        <button
          onClick={toggleFavorite}
          disabled={saving}
          className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {outfit.isFavorite ? "★ Saved" : "Save Outfit"}
        </button>
      </div>
    </main>
  );
}
