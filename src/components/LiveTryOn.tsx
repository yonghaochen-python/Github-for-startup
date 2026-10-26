"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClothingItem } from "@/components/OutfitCard";
import { mirrorFrame } from "@/components/ui";
import { LiquidGlass } from "@/components/LiquidGlass";
import { garmentName } from "@/lib/tryOn/types";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";
import type { TrayCategory } from "@/lib/shopCatalog";
import { addToWishlist } from "@/lib/shopWishlist";
import type { RealTimeClient } from "@decartai/sdk";

/**
 * Live Try On — preview. A live camera mirror beside the closet, where pieces can be picked
 * and swapped without restarting anything. On its own nothing is recorded or sent and no clothes are drawn on the
 * person (the page says so). For admin accounts where a Decart key is set, "AI try-on" can run Decart's real-time
 * try-on on the camera with the whole outfit (all pieces on one reference picture), after a tap on Start, for at
 * most 20 seconds a session (Decart also ends it then), stopping too when the tab is hidden or the page is left.
 *
 * It's the Studio's Live mirror: the Studio owns the look and the closet (the same ones as Photo), and this shows
 * the camera in the same frame as the Photo mirror, with the AI controls and any Shopping store links below it.
 */

type Source = "none" | "starting" | "camera";
/** A piece sent from Shopping; store finds keep their page link and store name. */
export type ShopPick = ClothingItem & { color?: string; productUrl?: string | null; retailer?: string };
type Ai = "off" | "confirm" | "connecting" | "on";

const nameOf = (piece: ClothingItem & { color?: string }) => garmentName({ description: piece.description, color: piece.color });

/** What to ask for: one piece swaps the matching part of what the person wears; several replace the outfit. */
function promptFor(pieces: ClothingItem[]): string {
  if (pieces.length === 1) {
    const [piece] = pieces;
    const part: Record<string, string> = {
      base_layer: "top",
      mid_layer: "top",
      outer_layer: "jacket",
      bottom: "trousers or skirt",
      one_piece: "outfit",
      shoes: "shoes",
    };
    return piece.layeringRole === "accessory" ? `Add ${nameOf(piece)}` : `Substitute the current ${part[piece.layeringRole] ?? "top"} with ${nameOf(piece)}`;
  }
  const names = pieces.map(nameOf);
  const list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Substitute the current clothes with the full outfit in the reference image: ${list}, worn together`;
}

const BAD_PICTURE = "A piece's picture couldn't be used. Try a clearer photo of just the piece.";

async function pictureOf(piece: ClothingItem): Promise<Blob> {
  const res = await fetch(piece.imageUrl).catch(() => null);
  if (!res?.ok) throw new Error(BAD_PICTURE);
  return res.blob();
}

/** The reference picture: the piece itself, or every piece laid out on one sheet (as the photo try-on does). */
async function referenceFor(pieces: ClothingItem[]): Promise<Blob> {
  if (pieces.length === 1) return pictureOf(pieces[0]);
  const shrunk = await Promise.all(pieces.map(async (p) => photoToJpeg(await pictureOf(p), 0.88, 1024)));
  return garmentSheetJpeg(shrunk);
}

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
const OFF = "M5 5l14 14M8 6h7l2 2h3v9M20 19H4V8h3";

export function LiveTryOn({
  outfit,
  picks = [],
}: {
  /** The Studio's current look. */
  outfit: ClothingItem[];
  /** Pieces brought from Shopping (their store links show below the mirror). */
  picks?: ShopPick[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [source, setSource] = useState<Source>("none");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const shopPicks = picks;
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  // Real-time AI preview (Decart), only where it's connected.
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [ai, setAi] = useState<Ai>("off");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [aiStream, setAiStream] = useState<MediaStream | null>(null);
  // Set when a mid-session outfit change is refused (the session keeps the last outfit).
  const [pieceError, setPieceError] = useState<string | null>(null);
  const rtRef = useRef<RealTimeClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ liveTryOn?: boolean }>)
      .then((data) => !ignore && setLiveAvailable(Boolean(data.liveTryOn)))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Ends the AI session (nothing more is used once it's stopped). */
  const stopAi = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    rtRef.current?.disconnect();
    rtRef.current = null;
    setAiStream(null);
    setAi((state) => (state === "confirm" ? state : "off"));
  }, []);

  /**
   * When an AI session ends (time's up, Stop, an error or the tab hidden), back to the start screen: the camera is
   * let go with the session, which would otherwise leave a black frame. A message, if any, shows there.
   */
  const endAi = useCallback(
    (message?: string) => {
      stopAi();
      stopCamera();
      setSource("none");
      setCameraError(message ?? null);
    },
    [stopAi, stopCamera]
  );

  // The camera and any AI session stop when leaving the page; the AI also stops when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && rtRef.current && endAi();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stopAi();
      stopCamera();
    };
  }, [stopAi, stopCamera, endAi]);

  async function startAi() {
    const stream = streamRef.current;
    if (!stream || outfit.length === 0) return;
    setAi("connecting");
    setPieceError(null);
    try {
      const tokenRes = await fetch("/api/live/token", { method: "POST" });
      const token = (await tokenRes.json().catch(() => ({}))) as { apiKey?: string; model?: string; maxSeconds?: number; error?: string };
      if (!tokenRes.ok || !token.apiKey || !token.model) throw new Error(token.error ?? "Couldn't start live try-on right now.");
      const [{ createDecartClient, models }, image] = await Promise.all([import("@decartai/sdk"), referenceFor(outfit)]);
      const client = createDecartClient({ apiKey: token.apiKey, telemetry: false });
      // Send the camera at the model's own size (1280×720, 30 fps) so Decart doesn't have to shrink or re-crop it.
      const model = models.realtime(token.model as "lucy-vton-latest");
      const fps = typeof model.fps === "number" ? model.fps : model.fps.ideal;
      await stream
        .getVideoTracks()[0]
        ?.applyConstraints({ width: { ideal: model.width }, height: { ideal: model.height }, frameRate: { ideal: fps } })
        .catch(() => {});
      const rt = await client.realtime.connect(stream, {
        model,
        // Decart gets the camera as it is (so logos and text on clothes stay the right way round); the page shows
        // its picture flipped, like the plain camera, so it looks like a mirror.
        mirror: false,
        onRemoteStream: (edited) => setAiStream(edited),
        initialState: { image, prompt: { text: promptFor(outfit), enhance: true } },
      });
      rtRef.current = rt;
      rt.on("sessionEnded", () => endAi());
      rt.on("error", (err) => endAi(err.message || "Live try-on stopped."));
      // Our own stop at the limit (Decart ends it too).
      let left = token.maxSeconds ?? 20;
      setSecondsLeft(left);
      timerRef.current = setInterval(() => {
        left -= 1;
        setSecondsLeft(left);
        if (left <= 0) endAi();
      }, 1000);
      setAi("on");
    } catch (err) {
      endAi(err instanceof Error ? err.message : "Couldn't start live try-on right now.");
    }
  }

  // Changing the outfit during a session updates it live, with no restart.
  const outfitKey = outfit.map((p) => p.id).join(",");
  useEffect(() => {
    const rt = rtRef.current;
    if (ai !== "on" || !rt || outfit.length === 0) return;
    let stop = false;
    referenceFor(outfit)
      .then((image) => {
        if (!stop) return rt.set({ image, prompt: promptFor(outfit), enhance: true });
      })
      .then(() => !stop && setPieceError(null))
      .catch(() => !stop && setPieceError(BAD_PICTURE));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the outfit changes
  }, [outfitKey]);

  useEffect(() => {
    if (aiVideoRef.current) aiVideoRef.current.srcObject = aiStream;
  }, [aiStream]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera here. Switch to Photo above to try it on your saved photo.");
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
          ? "Camera access was turned down. You can allow it in your browser's settings, or switch to Photo above."
          : "Couldn't start the camera. Check that no other app is using it, or switch to Photo above."
      );
    }
  }

  // Attach the stream once the video element is on screen.
  useEffect(() => {
    if (source === "camera" && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [source]);

  function turnOff() {
    stopAi();
    stopCamera();
    setSource("none");
  }

  const iconButton =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[rgba(255,255,255,0.08)] text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.16)]";

  return (
      <section aria-label="Live mirror" className="relative min-w-0 overflow-hidden rounded-[22px] shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]" style={STAGE_BG}>
        {/* A thin silver edge and a soft reflection across the glass. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/10" />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1/4 -top-1/3 h-2/3 w-[150%] rotate-[-14deg] opacity-60"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0) 60%)" }}
        />

        <div className={`${mirrorFrame} overflow-hidden bg-black/30`}>
          {source === "camera" && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${aiStream ? "invisible" : ""}`}
              aria-label="Your camera"
            />
          )}
          {/* The AI picture is wide (16:9): shown whole, centred in the frame. */}
          {source === "camera" && aiStream && (
            <video ref={aiVideoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" aria-label="AI try-on, live" />
          )}
          {/* Before the camera is on: Virm's slowly moving satin glass, as on Home (its colors follow the time of day). */}
          {(source === "none" || source === "starting") && <LiquidGlass className="absolute inset-0" />}
          {(source === "none" || source === "starting") && (
            <div className="glass-legible absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(18,24,33,0.12)] bg-[rgba(255,255,255,0.35)] text-[#26313a] backdrop-blur-md">
                <Icon d={CAMERA} className="h-7 w-7" />
              </span>
              <h2 className="font-display text-[34px] leading-tight text-[#121821]">Your live mirror</h2>
              <p className="mt-2 text-[13.5px] text-[#26313a]">20 second session</p>
              {cameraError && <p className="mt-4 max-w-xs rounded-[12px] bg-[rgba(255,255,255,0.7)] px-3 py-2 text-[12.5px] text-[#a3261b]">{cameraError}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={startCamera}
                  disabled={source === "starting"}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#121821] px-6 text-[13.5px] font-semibold text-white shadow-[0_8px_30px_rgba(18,24,33,0.18)] transition hover:bg-[#2a3542] disabled:opacity-70"
                >
                  <Icon d={CAMERA} className="h-4 w-4" />
                  {source === "starting" ? "Waiting for permission…" : "Turn on camera"}
                </button>
              </div>
            </div>
          )}

          {/* Honest label: says whether the AI is drawing the clothes right now. */}
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
            {ai === "on" ? `Live AI try-on · ${secondsLeft}s left` : "Prototype · clothes aren't drawn on you yet"}
          </span>

          {source === "camera" && (
            <div className="absolute right-3 top-12 flex flex-col gap-2">
              <button onClick={turnOff} aria-label="Turn off the camera" title="Turn off" className={iconButton}>
                <Icon d={OFF} />
              </button>
            </div>
          )}
        </div>

        {/* Below the mirror, like Photo's Try On bar: store links, the AI controls, and what Live does. */}
        <div className="relative flex flex-col gap-3 border-t border-white/10 p-4 sm:p-5">
        {/* Store finds: open the store page to buy, or save for later. */}
        {shopPicks.some((pick) => pick.productUrl || pick.id.startsWith("shop-ext-")) && (
          <div className="relative rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-4 py-3 text-[12.5px] text-[#c9d6dd] backdrop-blur-md">
            <ul className="flex flex-col gap-1.5">
              {shopPicks
                .filter((pick) => pick.productUrl || pick.id.startsWith("shop-ext-"))
                .map((pick) => {
                  const key = pick.id.replace(/^shop-/, "");
                  const saved = savedKeys.includes(key);
                  return (
                    <li key={pick.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="min-w-0 flex-1 truncate">
                        <b className="text-white">{pick.description}</b>
                        {pick.retailer && <span className="text-[#9fb6c0]"> · {pick.retailer}</span>}
                      </span>
                      {pick.productUrl && (
                        <a href={pick.productUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-4">
                          View in store ↗
                        </a>
                      )}
                      <button
                        onClick={() => {
                          const ok = addToWishlist({
                            key,
                            name: pick.description,
                            label: pick.retailer ?? "Store",
                            category: pick.category as TrayCategory,
                            layeringRole: pick.layeringRole,
                            color: pick.color ?? "",
                            imageUrl: pick.imageUrl,
                            price: null,
                            productUrl: pick.productUrl ?? null,
                          });
                          if (ok) setSavedKeys((list) => [...list, key]);
                        }}
                        disabled={saved}
                        className="font-medium text-white underline-offset-4 hover:underline disabled:opacity-60"
                      >
                        {saved ? "♥ Saved" : "♡ Save"}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {liveAvailable && source === "camera" && (
          <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-4 py-3 text-[12.5px] text-[#c9d6dd] backdrop-blur-md">
            {ai === "off" && (
              <>
                <span className="min-w-0 flex-1">
                  {outfit.length ? `AI try-on shows your whole outfit (${outfit.length} ${outfit.length === 1 ? "piece" : "pieces"}).` : "Pick pieces to try with AI."}
                </span>
                <button
                  onClick={() => setAi("confirm")}
                  disabled={outfit.length === 0}
                  className="rounded-full bg-[#7fd0d6] px-4 py-2 text-[12.5px] font-semibold text-[#0b1520] transition hover:bg-[#9adde2] disabled:opacity-40"
                >
                  AI try-on
                </button>
              </>
            )}
            {ai === "confirm" && (
              <>
                <span className="min-w-0 flex-1">Uses Decart credits, about $0.02 a second. Runs up to 20 seconds, then stops.</span>
                <button onClick={startAi} className="rounded-full bg-[#7fd0d6] px-4 py-2 text-[12.5px] font-semibold text-[#0b1520] hover:bg-[#9adde2]">
                  Start
                </button>
                <button onClick={() => setAi("off")} className="text-[12.5px] font-medium text-white underline-offset-4 hover:underline">
                  Cancel
                </button>
              </>
            )}
            {ai === "connecting" && <span className="flex-1">Connecting…</span>}
            {ai === "on" && (
              <>
                <span className={`min-w-0 flex-1 ${pieceError ? "text-[#ffd2cb]" : ""}`}>
                  {pieceError ?? "Showing your outfit. Change pieces in your closet to update it live."}
                </span>
                <button onClick={() => endAi()} className="rounded-full border border-white/25 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[rgba(255,255,255,0.1)]">
                  Stop
                </button>
              </>
            )}
          </div>
        )}

        <p className="relative px-1 text-center text-[11.5px] leading-snug text-[#8fa3ad]">
          {liveAvailable
            ? "The camera on its own is free. AI try-on is a preview of your whole outfit, up to 20 seconds."
            : "A preview of the Live experience. Real-time try-on, with clothes drawn on you as you move, isn't connected yet."}
        </p>
        </div>
      </section>
  );
}
