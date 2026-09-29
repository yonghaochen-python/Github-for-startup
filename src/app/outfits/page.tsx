"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
};

type Outfit = {
  id: string;
  rationale: string;
  createdAt: string;
  items: ClothingItem[];
};

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/outfits").then(async (res) => {
      if (ignore) return;
      if (res.status === 401) {
        setSignedOut(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { outfits?: Outfit[] };
      setOutfits(data.outfits ?? []);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt || undefined }),
      });
      const data = (await res.json()) as { error?: string; outfits?: Outfit[] };
      if (!res.ok || !data.outfits) throw new Error(data.error ?? "Couldn't generate outfits");
      const generated = data.outfits;
      setOutfits((prev) => [...generated, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate outfits");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Outfits</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Generate outfit combinations from the items already in your closet.
      </p>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Optional: describe an occasion (e.g. 'casual weekend brunch')"
          className="flex-1 rounded-full border border-black/15 bg-white px-4 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white/40"
        />
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {generating ? "Generating…" : "Generate outfit"}
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : signedOut ? (
        <p className="text-sm text-zinc-500">
          <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
            Log in
          </Link>{" "}
          to see your outfits.
        </p>
      ) : outfits.length === 0 ? (
        <p className="text-sm text-zinc-500">No outfits yet — generate your first one above.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="mb-3 flex gap-3">
                {outfit.items.map((item) => (
                  <div key={item.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                    <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{outfit.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
