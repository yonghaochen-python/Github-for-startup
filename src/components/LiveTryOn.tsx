"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import type { ClothingItem } from "@/components/OutfitCard";
import { LAYER_LABELS } from "@/lib/layering";
import { withPiece } from "@/lib/outfitPieces";

/**
 * Live Try On — UI prototype. A live camera mirror (or the saved photo) beside the closet, where pieces can be
 * picked and swapped without restarting anything. No AI runs here and nothing is recorded or sent: the camera
 * picture stays in the browser. The clothes are NOT drawn on the person; the page says so plainly. A real-time
 * try-on service can later take the camera stream and the chosen pieces from this same screen.
 */

const TABS = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

type Source = "none" | "starting" | "camera" | "photo";

// Deep navy glass with faint teal, violet and silver light, kept on the element itself so it reads the same at any hour.
// (Translucent whites on it are written as rgba(...) so the night-time rule for light cards doesn't darken their text.)
const STAGE_BG = {
  background:
    "radial-gradient(120% 70% at 0% 0%, rgba(84,170,178,0.18), transparent 55%), radial-gradient(90% 60% at 100% 100%, rgba(128,112,214,0.20), transparent 60%), linear-gradient(160deg, #0b1520 0%, #0f1f2b 48%, #141a2c 100%)",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}
const CAMERA = "M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z";
const PHOTO = "M4 5h16v14H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 9.5h.01";
const OFF = "M5 5l14 14M8 6h7l2 2h3v9M20 19H4V8h3";

export function LiveTryOn() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [source, setSource] = useState<Source>("none");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [closet, setCloset] = useState<ClothingItem[] | null>(null);
  const [tab, setTab] = useState("top");
  const [outfit, setOutfit] = useState<ClothingItem[]>([]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then(async (res) => (res.ok ? (((await res.json()) as { items?: ClothingItem[] }).items ?? []) : []))
      .then((items) => !ignore && setCloset(items))
      .catch(() => !ignore && setCloset([]));
    return () => {
      ignore = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // The camera turns off when leaving the page.
  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera here. You can use your saved photo instead.");
      return;
    }
    setSource("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setSource("camera");
    } catch (err) {
      setSource("none");
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was turned down. You can allow it in your browser's settings, or use your saved photo."
          : "Couldn't start the camera. Check that no other app is using it, or use your saved photo."
      );
    }
  }

  // Attach the stream once the video element is on screen.
  useEffect(() => {
    if (source === "camera" && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [source]);

  function usePhoto() {
    stopCamera();
    setCameraError(null);
    setSource("photo");
  }

  function turnOff() {
    stopCamera();
    setSource("none");
  }

  function toggle(item: ClothingItem) {
    setOutfit((current) => (current.some((p) => p.id === item.id) ? current.filter((p) => p.id !== item.id) : withPiece(current, item)));
  }

  const hasPhoto = Boolean(user?.photoVersion);
  const tabItems = (closet ?? []).filter((item) => item.category === tab);
  const countIn = (value: string) => outfit.filter((p) => p.category === value).length;
  const chosen = new Set(outfit.map((p) => p.id));
  const iconButton =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[rgba(255,255,255,0.08)] text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.16)]";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      {/* The mirror. */}
      <section aria-label="Live mirror" className="relative min-w-0 overflow-hidden rounded-[28px] p-3 sm:p-4" style={STAGE_BG}>
        {/* A thin silver edge and a soft reflection across the glass. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1/4 -top-1/3 h-2/3 w-[150%] rotate-[-14deg] opacity-60"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0) 60%)" }}
        />

        <div className="relative mx-auto aspect-[3/4] max-h-[72vh] overflow-hidden rounded-[22px] bg-black/30 ring-1 ring-white/10">
          {source === "camera" && (
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" aria-label="Your camera" />
          )}
          {source === "photo" && hasPhoto && (
            // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image
            <img src={`/api/me/photo?v=${user?.photoVersion}`} alt="Your saved photo" className="absolute inset-0 h-full w-full object-contain" />
          )}

          {(source === "none" || source === "starting") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-[rgba(255,255,255,0.07)] text-[#cfe3e6] backdrop-blur-md">
                <Icon d={CAMERA} className="h-7 w-7" />
              </span>
              <h2 className="font-display text-[34px] leading-tight text-white">Your live mirror</h2>
              <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-[#b9c6cf]">
                See yourself live, then swap pieces from your closet. The camera starts only when you tap, and nothing is
                recorded or sent anywhere.
              </p>
              {cameraError && <p className="mt-4 max-w-xs rounded-[12px] bg-[rgba(255,255,255,0.08)] px-3 py-2 text-[12.5px] text-[#ffd2cb]">{cameraError}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={startCamera}
                  disabled={source === "starting"}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-white px-6 text-[13.5px] font-semibold text-[#0b1520] shadow-[0_8px_30px_rgba(120,200,210,0.25)] transition hover:bg-[#eef5f6] disabled:opacity-70"
                >
                  <Icon d={CAMERA} className="h-4 w-4" />
                  {source === "starting" ? "Waiting for permission…" : "Turn on camera"}
                </button>
                {hasPhoto && (
                  <button
                    onClick={usePhoto}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-white/20 bg-[rgba(255,255,255,0.06)] px-6 text-[13.5px] font-medium text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.12)]"
                  >
                    <Icon d={PHOTO} className="h-4 w-4" />
                    Use my saved photo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Honest label: this is a layout prototype, not an AI try-on. */}
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
            Prototype · clothes aren&apos;t drawn on you yet
          </span>

          {(source === "camera" || source === "photo") && (
            <div className="absolute right-3 top-12 flex flex-col gap-2">
              {source === "camera" && hasPhoto && (
                <button onClick={usePhoto} aria-label="Use my saved photo instead" title="Use my saved photo" className={iconButton}>
                  <Icon d={PHOTO} />
                </button>
              )}
              {source === "photo" && (
                <button onClick={startCamera} aria-label="Use the camera instead" title="Use the camera" className={iconButton}>
                  <Icon d={CAMERA} />
                </button>
              )}
              <button onClick={turnOff} aria-label={source === "camera" ? "Turn off the camera" : "Close the photo"} title="Turn off" className={iconButton}>
                <Icon d={OFF} />
              </button>
            </div>
          )}
        </div>

        {/* The outfit being put together. */}
        <div className="relative mt-3 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-3 backdrop-blur-md sm:mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[#9fb6c0]">Your outfit</p>
            {outfit.length > 0 && (
              <button onClick={() => setOutfit([])} className="text-[12px] font-medium text-[#c9d6dd] underline-offset-4 hover:text-white hover:underline">
                Clear
              </button>
            )}
          </div>
          {outfit.length === 0 ? (
            <p className="px-1 pb-1 text-[13px] text-[#b9c6cf]">Tap pieces in your closet to build an outfit. Tap another to swap.</p>
          ) : (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {outfit.map((piece) => (
                <li key={piece.id} className="relative shrink-0 animate-[piece-in_.25s_ease-out] motion-reduce:animate-none">
                  <span className="relative block h-[84px] w-[70px] overflow-hidden rounded-[12px] bg-white/90">
                    <Image src={piece.imageUrl} alt={piece.description} fill unoptimized className="object-cover" />
                  </span>
                  <span className="mt-1 block w-[70px] truncate text-center text-[10.5px] text-[#b9c6cf]">{LAYER_LABELS[piece.layeringRole]}</span>
                  <button
                    onClick={() => toggle(piece)}
                    aria-label={`Take off ${piece.description}`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#0b1520] text-[13px] leading-none text-white"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="relative mt-3 px-1 text-center text-[11.5px] leading-snug text-[#8fa3ad]">
          A preview of the Live experience. Real-time try-on, with clothes drawn on you as you move, isn&apos;t connected yet.
        </p>
      </section>

      {/* The closet. */}
      <section aria-label="Your closet" className="min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:sticky lg:top-24">
        <div className="flex gap-1 overflow-x-auto border-b border-black/[0.06] px-3 pt-2">
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                aria-pressed={active}
                className={`relative shrink-0 px-2.5 pb-3 pt-2 text-[13px] ${
                  active
                    ? "font-semibold text-[#121821] after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#121821]"
                    : "text-[#5d6874] hover:text-[#121821]"
                }`}
              >
                {t.label}
                {countIn(t.value) > 0 && <span className="ml-1 text-[#2f8f97]">•</span>}
              </button>
            );
          })}
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-3">
          {closet === null ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-[#f1f3f4]" />
              ))}
            </div>
          ) : tabItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-[#5d6874]">Nothing here yet. Add clothes in My Closet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {tabItems.map((item) => {
                const on = chosen.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => toggle(item)}
                      aria-pressed={on}
                      title={item.description}
                      className={`group relative block aspect-square w-full overflow-hidden rounded-[14px] bg-[#f4f5f6] transition ${
                        on ? "ring-2 ring-[#2f8f97] ring-offset-2" : "hover:-translate-y-0.5"
                      }`}
                    >
                      <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover transition duration-300 group-hover:scale-[1.03]" />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2f8f97] text-white">
                          <Icon d="M5 12.5l4.5 4.5L19 7.5" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
