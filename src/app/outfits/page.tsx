"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Outfit } from "@/components/OutfitCard";
import { OutfitBoard, OutfitBoardSkeleton } from "@/components/OutfitBoard";
import { ClosetIcon, PlusIcon, SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, btnPrimary, eyebrow } from "@/components/ui";

const OCCASIONS = ["Everyday", "School", "Work", "Date", "Dinner", "Party", "Interview", "Special Event"];
const STYLES = ["Casual", "Minimal", "Streetwear", "Preppy", "Feminine", "Clean", "Custom"];
const CONDITIONS = ["Partly cloudy", "Sunny", "Cloudy", "Rainy", "Windy", "Snowy"];

const chip = (selected: boolean) =>
  `btn-tactile min-h-[40px] rounded-[5px] border px-4 text-[12.5px] font-medium transition-colors ${
    selected ? "border-[#1c2328] bg-[#1c2328] text-white" : "border-[#cbd7dc] bg-white/70 text-[#3b4850] hover:border-[#7e888e]"
  }`;
const inputClass =
  "min-h-[44px] w-full rounded-[5px] border border-[#cbd7dc] bg-white/80 px-3 text-[13px] text-[#1c2328] outline-none placeholder:text-[#9aa5aa] focus:border-[#1c2328]";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-[#dce2e4] py-6 sm:grid-cols-[200px_1fr] sm:gap-8">
      <div>
        <p className={`${eyebrow} mb-1`}>Step {n}</p>
        <h2 className="font-display text-[24px] font-normal leading-tight text-[#1c2328]">{title}</h2>
        {hint && <p className="mt-1 text-[12px] leading-relaxed text-[#7e888e]">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function OutfitsPage() {
  const [closetCount, setClosetCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<Outfit[]>([]);
  const [results, setResults] = useState<Outfit[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const [occasion, setOccasion] = useState("Everyday");
  const [styleChoice, setStyleChoice] = useState("Casual");
  const [customStyle, setCustomStyle] = useState("");
  const [temperature, setTemperature] = useState("");
  const [conditions, setConditions] = useState(CONDITIONS[0]);
  const [colorPreference, setColorPreference] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    fetch("/api/closet/items")
      .then(async (res) => (res.ok ? (((await res.json()) as { items?: unknown[] }).items ?? []).length : null))
      .then(setClosetCount)
      .catch(() => {});
    fetch("/api/outfits")
      .then(async (res) => (res.ok ? (((await res.json()) as { outfits?: Outfit[] }).outfits ?? []) : []))
      .then((list) => setRecent(list.slice(0, 6)))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    setResults([]);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const style = styleChoice === "Custom" ? customStyle || undefined : styleChoice;
      const weather = temperature ? `${temperature}, ${conditions}` : conditions;
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, weather, style, colorPreference: colorPreference || undefined, prompt: prompt || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; outfits?: Outfit[] };
      if (!res.ok || !data.outfits) throw new Error(data.error ?? "Couldn't generate outfits");
      setResults(data.outfits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate outfits");
    } finally {
      setGenerating(false);
    }
  }

  const updateOutfit = (updated: Outfit) => {
    setResults((list) => list.map((o) => (o.id === updated.id ? updated : o)));
    setRecent((list) => list.map((o) => (o.id === updated.id ? updated : o)));
  };

  const tooFewPieces = closetCount !== null && closetCount < 2;

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader
          label="AI Stylist"
          title="AI Stylist"
          description="Create outfits from the pieces you already own. Choose an occasion and generate outfit ideas from your closet."
        />

        {tooFewPieces ? (
          <EmptyState
            title="Add a few pieces first"
            body="Your stylist builds looks only from clothes in your closet, so it needs at least two pieces to work with."
            action={
              <Link href="/closet?add=1" className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add Clothes
              </Link>
            }
          />
        ) : (
          <div className="max-w-4xl">
            <Step n={1} title="Where are you going?" hint="Pick the occasion you're dressing for.">
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <button key={o} onClick={() => setOccasion(o)} className={chip(occasion === o)} aria-pressed={occasion === o}>
                    {o}
                  </button>
                ))}
              </div>
            </Step>

            <Step n={2} title="Your preferences" hint="Optional — skip anything you don't mind.">
              <p className="mb-2 text-[11px] font-semibold text-[#5f6a70]">Style</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyleChoice(s)} className={chip(styleChoice === s)} aria-pressed={styleChoice === s}>
                    {s}
                  </button>
                ))}
              </div>
              {styleChoice === "Custom" && (
                <input value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="Describe your style, e.g. soft tailoring" className={`${inputClass} mb-3 max-w-sm`} />
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Temperature
                  <input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="e.g. 65°F" className={`${inputClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Weather
                  <select value={conditions} onChange={(e) => setConditions(e.target.value)} className={`${inputClass} mt-1`}>
                    {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Preferred colors
                  <input value={colorPreference} onChange={(e) => setColorPreference(e.target.value)} placeholder="e.g. neutrals, something with blue" className={`${inputClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Anything else?
                  <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. comfortable shoes, no shorts" className={`${inputClass} mt-1`} />
                </label>
              </div>
            </Step>

            <Step n={3} title="Clothes to use" hint="Your stylist works with everything in your closet.">
              <div className="flex flex-wrap items-center gap-3 border border-[#dce2e4] bg-white/60 px-4 py-3">
                <ClosetIcon className="h-5 w-5 text-[#5f6a70]" />
                <p className="text-[13px] text-[#1c2328]">
                  Your whole closet{closetCount !== null ? ` — ${closetCount} pieces` : ""}
                </p>
                <Link href="/closet" className="ml-auto text-[12px] font-semibold text-[#26313a] underline-offset-4 hover:underline">
                  Review closet
                </Link>
              </div>
            </Step>

            <Step n={4} title="Generate" hint="Takes a few seconds. Each look uses only your own clothes.">
              <button onClick={handleGenerate} disabled={generating} className={`${btnPrimary} min-h-[52px] px-7 text-[13.5px]`}>
                <SparkleIcon className="h-4 w-4" />
                {generating ? "Creating your outfits…" : "Generate My Outfits"}
              </button>
            </Step>
          </div>
        )}

        <div ref={resultsRef} className="scroll-mt-24">
          {error && (
            <div className="mt-6 max-w-2xl">
              <ErrorNote message={error} />
            </div>
          )}

          {(generating || results.length > 0) && (
            <section aria-labelledby="results-title" aria-busy={generating} className="mt-10">
              <div className="mb-5">
                <p className={`${eyebrow} mb-1`}>Your new looks</p>
                <h2 id="results-title" className="font-display text-[34px] font-normal text-[#1c2328]">
                  {generating ? "Your stylist is putting looks together…" : `${results.length} outfits for ${occasion.toLowerCase()}`}
                </h2>
                {!generating && (
                  <p className="mt-1 text-[13px] text-[#5f6a70]">
                    Press Try On to see a look on your saved photo, or Save Look to keep it.
                  </p>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {generating
                  ? [0, 1, 2].map((i) => <OutfitBoardSkeleton key={i} />)
                  : results.map((outfit) => <OutfitBoard key={outfit.id} outfit={outfit} onSavedChange={updateOutfit} />)}
              </div>
            </section>
          )}

          {!generating && results.length === 0 && recent.length > 0 && (
            <section aria-labelledby="recent-title" className="mt-12">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className={`${eyebrow} mb-1`}>Recent</p>
                  <h2 id="recent-title" className="font-display text-[30px] font-normal text-[#1c2328]">Your latest outfits</h2>
                </div>
                <Link href="/outfits/saved" className="text-[12.5px] font-semibold text-[#26313a] underline-offset-4 hover:underline">
                  View Saved Looks
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {recent.slice(0, 3).map((outfit) => (
                  <OutfitBoard key={outfit.id} outfit={outfit} onSavedChange={updateOutfit} />
                ))}
              </div>
            </section>
          )}
        </div>
      </PageShell>
    </main>
  );
}
