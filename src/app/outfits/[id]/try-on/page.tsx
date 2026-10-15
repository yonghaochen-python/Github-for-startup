"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LAYER_LABELS, type LayeringRole } from "@/lib/layering";
import { LoadingScreen } from "@/components/LoadingScreen";
import { InlineLoading } from "@/components/InlineLoading";
import { TryOnPhotoStep } from "@/components/TryOnPhotoStep";
import { useTryOnSession } from "@/components/TryOnSessionProvider";
import { useToast } from "@/components/Toast";
import { afterMinDelay } from "@/lib/minDelay";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";

type OutfitItem = { id: string; imageUrl: string; description: string; layeringRole: LayeringRole };
type OutfitLayer = { role: LayeringRole; items: OutfitItem[] };
type Outfit = { id: string; isFavorite: boolean; occasion: string | null; style: string | null; layers: OutfitLayer[] };
type NotShown = { role: LayeringRole; description: string; reason: string };
type TryOnResult = { isMock: boolean; provider: string; imageDataUrl: string | null; layers: OutfitLayer[]; notShown?: NotShown[] };

type Stage = "setup" | "generating" | "result";

/** 3:4 preview, as large as fits on a phone screen (never taller than 70% of it). */
const previewStyle = { height: "min(70dvh, calc((100vw - 3rem) * 4 / 3), 693px)", aspectRatio: "3 / 4" } as const;

const buttonBase =
  "btn-tactile touch-manipulation inline-flex min-h-[48px] items-center justify-center rounded-[5px] px-3 py-3 text-[13px] font-semibold disabled:opacity-50 sm:px-6";
const primaryButton = `${buttonBase} bg-[#242b30] text-white shadow-[inset_0_1px_0_#ffffff35,0_6px_18px_rgba(34,42,47,0.2)] hover:bg-[#3b4750]`;
const secondaryButton = `${buttonBase} border border-[#cbd3d7] bg-white/60 text-[#333f46] hover:bg-[#e9edef]`;
const textLink =
  "inline-flex min-h-[44px] touch-manipulation items-center text-xs font-semibold text-[#445159] hover:underline";

/** Phone: the main action stays pinned to the bottom edge, above the home indicator. Desktop: not used. */
function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-6 mt-8 flex gap-3 border-t border-[#d9dfdf] bg-[#f6f9fa]/90 px-6 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden">
      {children}
    </div>
  );
}

function OutfitPieces({ layers }: { layers: OutfitLayer[] }) {
  return (
    <div className="flex flex-col">
      {layers.flatMap((layer) =>
        layer.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3.5 border-b border-[#e8eae3] py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-[#efeee9]">
              <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#222a2f]">{item.description}</p>
              <span className="text-[10px] tracking-[1.1px] text-[#9ba49a]">{LAYER_LABELS[layer.role]}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function TryOnPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const session = useTryOnSession();
  const photo = session.photo;
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [stage, setStage] = useState<Stage>("setup");
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveProvider, setLiveProvider] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/outfits/${params.id}`)
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 404 || res.status === 401) return setLoadState("missing");
        if (!res.ok) throw new Error("load");
        const data = (await res.json()) as { outfit: Outfit };
        if (ignore) return;
        setOutfit(data.outfit);
        setLoadState("ready");
      })
      .catch(() => {
        if (!ignore) setLoadState("error");
      });
    return () => {
      ignore = true;
    };
  }, [params.id]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ tryOnLive?: boolean }>)
      .then((data) => {
        if (!ignore) setLiveProvider(Boolean(data.tryOnLive));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function confirmPhoto(blob: Blob) {
    session.setPhoto(blob);
    setError(null);
  }

  function changePhoto() {
    session.clearPhoto();
    setResult(null);
    setStage("setup");
  }

  async function generate() {
    if (!photo || !outfit) return;
    setError(null);
    session.touch();
    setStage("generating");
    const startedAt = Date.now();
    try {
      const formData = new FormData();
      formData.append("photo", photo.blob, "photo.jpg");
      if (liveProvider) {
        // A real try-on needs each garment's photo; shrink them here so phones upload small files.
        const items = outfit.layers.flatMap((layer) => layer.items);
        const photos = await Promise.allSettled(
          items.map(async (item) => {
            const res = await fetch(item.imageUrl);
            if (!res.ok) throw new Error("garment");
            return photoToJpeg(await res.blob(), 0.88, 1024);
          })
        );
        photos.forEach((p, i) => {
          if (p.status === "fulfilled") formData.append(`garment:${items[i].id}`, p.value, `${items[i].id}.jpg`);
        });
        // Providers that dress a whole outfit in one call use every piece on a single sheet.
        if (photos.every((p) => p.status === "fulfilled")) {
          const sheet = await garmentSheetJpeg(photos.map((p) => (p as PromiseFulfilledResult<Blob>).value)).catch(() => null);
          if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
        }
      }
      const res = await fetch(`/api/outfits/${outfit.id}/try-on`, { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string; result?: TryOnResult };
      if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
      // Hold the branded loading state briefly so the step reads as a distinct moment, even for the instant prototype provider.
      await new Promise<void>((resolve) => afterMinDelay(startedAt, 1400, resolve));
      setResult(data.result);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the try-on right now.");
      setStage("setup");
    }
  }

  async function saveLook() {
    if (!outfit || outfit.isFavorite) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: true }),
      });
      const data = (await res.json()) as { outfit?: Outfit };
      if (!res.ok || !data.outfit) throw new Error("save");
      setOutfit((prev) => (prev ? { ...prev, isFavorite: true } : prev));
      showToast("Look added to your saved collection.");
    } catch {
      setError("Couldn't save this look. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (stage === "generating") return <LoadingScreen />;

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 sm:px-8 sm:py-14">
        <InlineLoading />
      </main>
    );
  }

  if (loadState !== "ready" || !outfit) {
    return (
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 sm:px-8 sm:py-14">
        <p className="text-sm text-[#89949a]">
          {loadState === "error" ? "Couldn't load this outfit. Please try again." : "Outfit not found."} Back to{" "}
          <Link href="/outfits" className="text-[#303a30] hover:underline">
            outfits
          </Link>
          .
        </p>
      </main>
    );
  }

  const outfitName = [outfit.style, outfit.occasion].filter(Boolean).join(" ") || "Your outfit";
  const showResult = stage === "result" && result && photo;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-5 sm:px-8 sm:pt-14">
      <Link
        href={`/outfits/${outfit.id}`}
        className="group mb-2 inline-flex min-h-[44px] items-center gap-2.5 text-xs font-semibold text-[#747d71] sm:mb-5"
      >
        <span className="text-lg leading-none transition-transform duration-200 group-hover:-translate-x-1">←</span> Back to
        outfit
      </Link>

      <div className="mb-6 sm:mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">Virtual try-on</p>
        <h1
          className="font-display mt-2 font-normal tracking-[-2px] text-[#1c2328] sm:mt-3"
          style={{ fontSize: "clamp(38px, 4.5vw, 60px)", lineHeight: 1.02 }}
        >
          {stage === "result" ? "Your try-on." : "Try it on."}
        </h1>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-x-[7%] gap-y-10 lg:grid-cols-[1.03fr_.97fr]">
        <div>
          {stage === "setup" && !photo && <TryOnPhotoStep onConfirm={confirmPhoto} />}

          {stage === "setup" && photo && (
            <div>
              <div
                className="relative mx-auto overflow-hidden border border-[#d9dfdf] bg-white"
                style={previewStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Your photo" className="h-full w-full object-contain" />
              </div>
              <div className="mx-auto mt-1 flex max-w-[520px] items-center justify-between gap-3 text-xs text-[#8b9087]">
                <span>Kept on this device for this session only.</span>
                <button onClick={changePhoto} className={textLink}>
                  Change photo
                </button>
              </div>
            </div>
          )}

          {showResult && (
            <div>
              <div
                className="relative mx-auto overflow-hidden border border-[#d9dfdf] bg-white"
                style={previewStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.imageDataUrl ?? photo.url}
                  alt={result.imageDataUrl ? "You wearing this outfit" : "Your photo"}
                  className="h-full w-full object-contain"
                />
                {result.isMock && (
                  <span className="absolute left-3 top-3 bg-[#242b30]/90 px-3 py-1.5 text-[9px] font-bold tracking-[1.6px] text-white">
                    PROTOTYPE PREVIEW
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-1">
          {stage === "result" && result?.isMock && (
            <p className="mb-6 border border-[#e0d3b8] bg-[#f8f3e6] px-4 py-3 text-[13px] leading-relaxed text-[#6b5a2c]">
              <strong className="font-semibold">This is a prototype.</strong> The AI try-on isn&apos;t connected yet, so
              this shows your photo next to the pieces — it is not a generated image of you wearing them.
            </p>
          )}

          {stage === "result" && result && !result.isMock && (
            <p className="mb-6 text-xs leading-relaxed text-[#8b9087]">
              AI-generated preview — fit and small details may differ slightly from the real pieces.
              {result.notShown && result.notShown.length > 0 && (
                <>
                  {" "}
                  Not shown: {result.notShown.map((n) => `${LAYER_LABELS[n.role].toLowerCase()} (${n.description})`).join(", ")}.{" "}
                  This try-on covers tops, bottoms, layers, and dresses.
                </>
              )}
            </p>
          )}

          <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">{outfitName}</p>
          <div className="mb-2 mt-1 flex items-center justify-between gap-3 border-b border-[#dfe3da] pb-1.5">
            <h2 className="font-display text-xl font-normal text-[#1c2328]">
              Pieces in this look{" "}
              <span className="font-sans text-[9px] tracking-[1.5px] text-[#9ba49a]">
                · {outfit.layers.reduce((n, l) => n + l.items.length, 0)} ITEMS
              </span>
            </h2>
            {stage === "setup" && (
              <Link href={`/outfits/${outfit.id}`} className={textLink}>
                Change outfit
              </Link>
            )}
          </div>
          <OutfitPieces layers={outfit.layers} />

          {stage === "setup" && (
            <div className="mt-8 hidden lg:block">
              <button onClick={generate} disabled={!photo} className={`${primaryButton} w-full`}>
                Try This Outfit On
              </button>
              <p className="mt-3 text-xs text-[#8b9087]">
                {photo ? "Ready when you are." : "Add and confirm your photo to continue."}
              </p>
            </div>
          )}

          {stage === "result" && (
            <>
              <div className="mt-8 hidden flex-col gap-3 lg:flex">
                <button onClick={saveLook} disabled={saving || outfit.isFavorite} className={primaryButton}>
                  {outfit.isFavorite ? "★ Look saved" : saving ? "Saving…" : "Save Look"}
                </button>
                <div className="flex gap-3">
                  <Link href="/outfits" className={`${secondaryButton} flex-1`}>
                    Try Another Outfit
                  </Link>
                  <Link href={`/outfits/${outfit.id}`} className={`${secondaryButton} flex-1`}>
                    Back to Outfit
                  </Link>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-1 lg:mt-3">
                <Link href={`/outfits/${outfit.id}`} className={`${secondaryButton} lg:hidden`}>
                  Back to Outfit
                </Link>
                <button onClick={changePhoto} className={`${textLink} self-start`}>
                  Use a different photo
                </button>
                <p className="text-xs text-[#8b9087]">Your photo stays ready for the next outfit — it&apos;s never saved to your account.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {stage === "setup" && photo && (
        <StickyBar>
          <button onClick={generate} className={`${primaryButton} flex-1`}>
            Try This Outfit On
          </button>
        </StickyBar>
      )}

      {stage === "result" && (
        <StickyBar>
          <button onClick={saveLook} disabled={saving || outfit.isFavorite} className={`${primaryButton} flex-1`}>
            {outfit.isFavorite ? "★ Look saved" : saving ? "Saving…" : "Save Look"}
          </button>
          <Link href="/outfits" className={`${secondaryButton} flex-1`}>
            Try Another Outfit
          </Link>
        </StickyBar>
      )}

      <div className="pb-8 sm:pb-14" />
    </main>
  );
}
