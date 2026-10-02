"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OutfitCard, type Outfit } from "@/components/OutfitCard";

const OCCASIONS = ["Everyday", "Class", "Work", "Date", "Dinner", "Party", "Interview", "Special Event"];
const STYLES = ["Casual", "Minimal", "Streetwear", "Preppy", "Feminine", "Clean", "Custom"];
const CONDITIONS = ["Partly cloudy", "Sunny", "Cloudy", "Rainy", "Windy", "Snowy"];

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
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-14 sm:px-8">
      <div className="mb-14 max-w-xl">
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">AI Stylist</p>
        <h1
          className="font-display mt-3 font-normal tracking-[-2px] text-[#1c2328]"
          style={{ fontSize: "clamp(36px, 4.5vw, 56px)" }}
        >
          Tell me where you&apos;re going.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#858b81]">
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
        <div className="max-w-2xl border-t border-[#dfe3d9] pt-8">
          <p className="mb-4 text-[9px] font-bold uppercase tracking-[1.8px] text-[#9da99a]">Occasion</p>
          <div className="mb-8 flex flex-wrap gap-2.5">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => setOccasion(o)}
                className={`btn-tactile min-w-[75px] rounded-[4px] border px-4 py-2.5 text-xs transition-colors ${
                  occasion === o
                    ? "border-[#354233] bg-[#354233] text-white"
                    : "border-[#d8dcd3] text-[#6c7469] hover:border-[#768674]"
                }`}
              >
                {o}
              </button>
            ))}
          </div>

          <p className="mb-4 text-[9px] font-bold uppercase tracking-[1.8px] text-[#9da99a]">Style</p>
          <div className="mb-2 flex flex-wrap gap-2.5">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyleChoice(s)}
                className={`btn-tactile min-w-[75px] rounded-[4px] border px-4 py-2.5 text-xs transition-colors ${
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
              className="mb-8 w-full max-w-xs border-0 border-b border-[#cbd2c6] bg-transparent px-0 py-2 text-sm text-[#222a2f] outline-none placeholder:text-[#9ba198] focus:border-[#768674]"
            />
          )}
          {styleChoice !== "Custom" && <div className="mb-8" />}

          <p className="mb-4 text-[9px] font-bold uppercase tracking-[1.8px] text-[#9da99a]">Weather</p>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.3fr]">
            <label className="flex flex-col gap-2">
              <span className="text-[9px] font-bold tracking-[1.3px] text-[#939e91]">TEMPERATURE</span>
              <input
                type="text"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="e.g. 65°F"
                className="h-11 w-full border border-[#d9ded4] bg-transparent px-3 text-xs text-[#444e41] outline-none transition-colors focus:border-[#768674]"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[9px] font-bold tracking-[1.3px] text-[#939e91]">CONDITIONS</span>
              <select
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className="h-11 w-full border border-[#d9ded4] bg-transparent px-3 text-xs text-[#444e41] outline-none transition-colors focus:border-[#768674]"
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
            className="mb-9 w-full border-0 border-b border-[#cbd2c6] bg-transparent px-0 py-2 text-sm text-[#222a2f] outline-none placeholder:text-[#9ba198] focus:border-[#768674]"
          />

          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-tactile inline-flex min-h-[56px] items-center gap-3 rounded-[5px] bg-[#242b30] px-8 text-[13px] font-semibold tracking-wide text-white shadow-[inset_0_1px_0_#ffffff35,0_8px_24px_rgba(34,42,47,0.2)] hover:bg-[#3b4750] disabled:opacity-50"
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
        <div className="mt-20">
          <p className="mb-6 text-[9px] font-bold uppercase tracking-[1.8px] text-[#9da99a]">Your looks</p>
          <div className="grid gap-[32px_24px] sm:grid-cols-2 xl:grid-cols-3">
            {justGenerated.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
