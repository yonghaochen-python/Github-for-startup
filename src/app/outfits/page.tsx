"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LayeringRole } from "@/lib/layering";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";

const OCCASIONS = ["Everyday", "Class", "Work", "Date", "Dinner", "Party", "Interview", "Special Event"];
const STYLES = ["Casual", "Minimal", "Streetwear", "Preppy", "Feminine", "Clean", "Custom"];
const CONDITIONS = ["Partly cloudy", "Sunny", "Cloudy", "Rainy", "Windy", "Snowy"];

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

export default function OutfitsPage() {
  const [closetCount, setClosetCount] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [justGenerated, setJustGenerated] = useState<Outfit[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState("Everyday");
  const [styleChoice, setStyleChoice] = useState("Casual");
  const [customStyle, setCustomStyle] = useState("");
  const [temperature, setTemperature] = useState("");
  const [conditions, setConditions] = useState(CONDITIONS[0]);
  const [colorPreference, setColorPreference] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 401) {
          setSignedOut(true);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { items?: unknown[] };
        setClosetCount((data.items ?? []).length);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const style = styleChoice === "Custom" ? customStyle || undefined : styleChoice;
      const weather = temperature ? `${temperature}, ${conditions}` : undefined;
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion,
          weather,
          style,
          colorPreference: colorPreference || undefined,
          prompt: prompt || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; outfits?: Outfit[] };
      if (!res.ok || !data.outfits) throw new Error(data.error ?? "Couldn't generate outfits");
      setJustGenerated(data.outfits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate outfits");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-10 sm:px-8">
      <div className="mb-10 max-w-lg">
        <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">AI stylist</p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-[-2px] text-[#222a2f] sm:text-5xl">
          Tell me where you&apos;re going.
        </h1>
        <p className="mt-2 text-sm text-[#858b81]">
          Pick the occasion, the vibe, and today&apos;s weather — I&apos;ll build the look from what you already own.
        </p>
      </div>

      {signedOut ? (
        <p className="text-sm text-[#89949a]">
          <Link href="/login" className="text-[#303a30] hover:underline">
            Log in
          </Link>{" "}
          to use the AI stylist.
        </p>
      ) : (
        <div className="max-w-2xl border-t border-[#dfe3d9] pt-7">
          <p className="mb-3 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9da99a]">Occasion</p>
          <div className="mb-7 flex flex-wrap gap-2.5">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => setOccasion(o)}
                className={`min-w-[75px] rounded-[4px] border px-4 py-2.5 text-xs transition-colors ${
                  occasion === o
                    ? "border-[#354233] bg-[#354233] text-white"
                    : "border-[#d8dcd3] text-[#6c7469] hover:border-[#768674]"
                }`}
              >
                {o}
              </button>
            ))}
          </div>

          <p className="mb-3 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9da99a]">Style</p>
          <div className="mb-2 flex flex-wrap gap-2.5">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyleChoice(s)}
                className={`min-w-[75px] rounded-[4px] border px-4 py-2.5 text-xs transition-colors ${
                  styleChoice === s
                    ? "border-[#354233] bg-[#354233] text-white"
                    : "border-[#d8dcd3] text-[#6c7469] hover:border-[#768674]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {styleChoice === "Custom" && (
            <input
              type="text"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              placeholder="Describe your style"
              className="mb-7 w-full max-w-xs border-0 border-b border-[#cbd2c6] bg-transparent px-0 py-2 text-sm text-[#222a2f] outline-none placeholder:text-[#9ba198] focus:border-[#768674]"
            />
          )}
          {styleChoice !== "Custom" && <div className="mb-7" />}

          <p className="mb-3 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9da99a]">Weather</p>
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.3fr]">
            <label className="flex flex-col gap-2">
              <span className="text-[9px] font-bold tracking-[1.3px] text-[#939e91]">TEMPERATURE</span>
              <input
                type="text"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="e.g. 65°F"
                className="h-11 w-full border border-[#d9ded4] bg-transparent px-3 text-xs text-[#444e41] outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[9px] font-bold tracking-[1.3px] text-[#939e91]">CONDITIONS</span>
              <select
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className="h-11 w-full border border-[#d9ded4] bg-transparent px-3 text-xs text-[#444e41] outline-none"
              >
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <input
            type="text"
            value={colorPreference}
            onChange={(e) => setColorPreference(e.target.value)}
            placeholder="Color preference (optional)"
            className="mb-3 w-full border-0 border-b border-[#cbd2c6] bg-transparent px-0 py-2 text-sm text-[#222a2f] outline-none placeholder:text-[#9ba198] focus:border-[#768674]"
          />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Anything else? (optional)"
            className="mb-7 w-full border-0 border-b border-[#cbd2c6] bg-transparent px-0 py-2 text-sm text-[#222a2f] outline-none placeholder:text-[#9ba198] focus:border-[#768674]"
          />

          <div className="flex items-center gap-5">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex min-h-[49px] items-center gap-6 rounded-[5px] bg-[#242b30] px-5 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750] disabled:opacity-50"
            >
              {generating ? "Styling…" : "Style Me"}
            </button>
            {closetCount !== null && (
              <span className="text-[10px] text-[#9aa198]">Made with the {closetCount} pieces in your closet</span>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-6 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {justGenerated.length > 0 && (
        <div className="mt-14">
          <p className="mb-5 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9da99a]">Your looks</p>
          <div className="grid gap-[27px_22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {justGenerated.map((outfit) => (
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
                  {outfit.isFavorite && <span className="shrink-0 text-xs font-medium text-[#354134]">★</span>}
                </div>
                <div className="overflow-hidden bg-white">
                  <EditorialOutfitVisual items={outfit.layers.flatMap((layer) => layer.items)} />
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm leading-relaxed text-[#737d82]">{outfit.rationale}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
