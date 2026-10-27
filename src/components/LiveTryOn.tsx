"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ClothingItem } from "@/components/OutfitCard";
import { mirrorFrame } from "@/components/ui";
import { LiquidGlass } from "@/components/LiquidGlass";
import { TRY_ON_CAVEAT } from "@/lib/tryOnClient";
import { garmentName } from "@/lib/tryOn/types";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";
import type { TrayCategory } from "@/lib/shopCatalog";
import { addToWishlist } from "@/lib/shopWishlist";
import { startRecording, type LiveRecording } from "@/lib/liveRecording";
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
type Ai = "off" | "confirm" | "countdown" | "connecting" | "on";
/** After a session: the recorded AI video (kept in memory only), or why there's no replay. */
type Replay = { file: File; url: string } | { failed: string };

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
  // 3-2-1 before anything billable starts (no token, no Decart session until it reaches 0).
  const [count, setCount] = useState(3);
  // The session's AI video, recorded in this page's memory from its first frame; never uploaded or stored.
  const recordingRef = useRef<LiveRecording | null>(null);
  const recordingTriedRef = useRef(false);
  const [replay, setReplay] = useState<Replay | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  // "Save to Virm": only on an explicit click; the video is stored privately for this person.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");

  /** Ends the recording: keep it for the replay (a session that ended), or throw it away. */
  const finishRecording = useCallback((keep: boolean) => {
    const recording = recordingRef.current;
    const tried = recordingTriedRef.current;
    recordingRef.current = null;
    recordingTriedRef.current = false;
    if (!keep) {
      recording?.discard();
      return;
    }
    if (!tried) return; // The AI never showed a frame, so there's nothing to replay.
    if (!recording) {
      setReplay({ failed: "Replay isn't available in this browser." });
      return;
    }
    recording.stop().then((file) =>
      setReplay(file ? { file, url: URL.createObjectURL(file) } : { failed: "Replay isn't available for this session." })
    );
  }, []);

  // The replay's in-memory video is let go whenever it's replaced or closed, or the page is left.
  useEffect(
    () => () => {
      if (replay && "url" in replay) URL.revokeObjectURL(replay.url);
    },
    [replay]
  );

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
      finishRecording(true);
      stopAi();
      stopCamera();
      setSource("none");
      setCameraError(message ?? null);
    },
    [stopAi, stopCamera, finishRecording]
  );

  // The camera and any AI session stop when leaving the page; the AI also stops when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && rtRef.current && endAi();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      finishRecording(false);
      stopAi();
      stopCamera();
    };
  }, [stopAi, stopCamera, endAi, finishRecording]);

  /** Start: a 3-2-1 first, then the session (the countdown isn't part of the 20 seconds). */
  function beginCountdown() {
    setReplay(null);
    setShareNote(null);
    setSaveState("idle");
    setCount(3);
    setAi("countdown");
  }

  /** Recording starts with the first AI frame actually shown. */
  function onAiPlaying() {
    if (recordingTriedRef.current || !aiStream) return;
    recordingTriedRef.current = true;
    recordingRef.current = startRecording(aiStream);
  }

  async function share(file: File) {
    setShareNote(null);
    try {
      await navigator.share({ files: [file], title: "My Virm live try-on" });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setShareNote("Couldn't share the video. You can download it instead.");
    }
  }

  function closeReplay() {
    setReplay(null);
    setShareNote(null);
    setSaveState("idle");
  }

  async function saveToVirm(file: File) {
    setSaveState("saving");
    const form = new FormData();
    form.append("video", file, file.name);
    try {
      const res = await fetch("/api/me/live-videos", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the video. Please try again.");
      setSaveState("saved");
    } catch (err) {
      setSaveState({ error: err instanceof Error ? err.message : "Couldn't save the video. Please try again." });
    }
  }

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

  // The countdown ticks once a second (3, 2, 1); a second after "1" the session starts.
  useEffect(() => {
    if (ai !== "countdown") return;
    const tick = setTimeout(() => (count <= 1 ? startAi() : setCount((c) => c - 1)), 1000);
    return () => clearTimeout(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on each tick of the countdown
  }, [ai, count]);

  // Leaving the tab during the countdown cancels it, so a session never starts out of sight.
  useEffect(() => {
    if (ai !== "countdown") return;
    const onHide = () => document.visibilityState === "hidden" && setAi("off");
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [ai]);

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
    closeReplay();
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
    finishRecording(false);
    stopAi();
    stopCamera();
    setSource("none");
  }

  const iconButton =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[rgba(255,255,255,0.08)] text-white backdrop-blur-md transition hover:bg-[rgba(255,255,255,0.16)]";

  return (
      // The same white card as the Photo mirror; only the picture area is the dark camera glass.
      <section aria-label="Live mirror" className="relative min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
        <div className={`${mirrorFrame} overflow-hidden`} style={STAGE_BG}>
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
            <video
              ref={aiVideoRef}
              autoPlay
              playsInline
              muted
              onPlaying={onAiPlaying}
              className="absolute inset-0 h-full w-full -scale-x-100 object-contain"
              aria-label="AI try-on, live"
            />
          )}
          {/* 3, 2, 1 over the camera before the session starts. */}
          {ai === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(8,14,22,0.35)]" aria-live="assertive">
              <span key={count} className="font-display text-[128px] leading-none text-white animate-[piece-in_.3s_ease-out] motion-reduce:animate-none">
                {count}
              </span>
            </div>
          )}
          {/* The replay: mirrored like the live view (the file itself isn't). In memory only. */}
          {replay && "url" in replay && (
            <video
              ref={replayVideoRef}
              src={replay.url}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 z-10 h-full w-full -scale-x-100 bg-[#0b1520] object-contain"
              aria-label="Replay of your live try-on"
            />
          )}
          {/* Before the camera is on: Virm's slowly moving satin glass, as on Home (its colors follow the time of day). */}
          {(source === "none" || source === "starting") && !(replay && "url" in replay) && <LiquidGlass className="absolute inset-0" />}
          {(source === "none" || source === "starting") && !(replay && "url" in replay) && (
            <div className="glass-legible glass-text absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="glass-icon mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(18,24,33,0.12)] bg-[rgba(255,255,255,0.35)] text-[#26313a] backdrop-blur-md">
                <Icon d={CAMERA} className="h-7 w-7" />
              </span>
              <h2 className="font-display text-[34px] leading-tight text-[#121821]">Your live mirror</h2>
              <p className="mt-2 text-[13.5px] text-[#26313a]">20 second session</p>
              {cameraError && <p className="glass-keep mt-4 max-w-xs rounded-[12px] bg-[rgba(255,255,255,0.7)] px-3 py-2 text-[12.5px] text-[#a3261b]">{cameraError}</p>}
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
            {replay && "url" in replay
              ? "Replay · not saved"
              : ai === "on"
                ? `Live AI try-on · ${secondsLeft}s left`
                : "Prototype · clothes aren't drawn on you yet"}
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
        <div className="flex flex-col gap-3 border-t border-black/[0.06] p-4 sm:p-5">
        {/* Store finds: open the store page to buy, or save for later. */}
        {shopPicks.some((pick) => pick.productUrl || pick.id.startsWith("shop-ext-")) && (
          <div className="rounded-[14px] bg-[#f4f5f6] px-4 py-3 text-[12.5px] text-[#4f5b66]">
            <ul className="flex flex-col gap-1.5">
              {shopPicks
                .filter((pick) => pick.productUrl || pick.id.startsWith("shop-ext-"))
                .map((pick) => {
                  const key = pick.id.replace(/^shop-/, "");
                  const saved = savedKeys.includes(key);
                  return (
                    <li key={pick.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="min-w-0 flex-1 truncate">
                        <b className="text-[#121821]">{pick.description}</b>
                        {pick.retailer && <span className="text-[#5d6874]"> · {pick.retailer}</span>}
                      </span>
                      {pick.productUrl && (
                        <a href={pick.productUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#121821] underline underline-offset-4">
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
                        className="font-medium text-[#121821] underline-offset-4 hover:underline disabled:opacity-60"
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-[#f4f5f6] px-4 py-3 text-[12.5px] text-[#4f5b66]">
            {ai === "off" && (
              <>
                <span className="min-w-0 flex-1">
                  {outfit.length ? `AI try-on shows your whole outfit (${outfit.length} ${outfit.length === 1 ? "piece" : "pieces"}).` : "Pick pieces to try with AI."}
                </span>
                <button
                  onClick={() => setAi("confirm")}
                  disabled={outfit.length === 0}
                  className="rounded-full bg-[#121821] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#2a3542] disabled:opacity-40"
                >
                  AI try-on
                </button>
              </>
            )}
            {ai === "confirm" && (
              <>
                <span className="min-w-0 flex-1">Uses Decart credits, about $0.02 a second. Runs up to 20 seconds, then stops.</span>
                <button onClick={beginCountdown} className="rounded-full bg-[#121821] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2a3542]">
                  Start
                </button>
                <button onClick={() => setAi("off")} className="text-[12.5px] font-medium text-[#121821] underline-offset-4 hover:underline">
                  Cancel
                </button>
              </>
            )}
            {ai === "countdown" && (
              <>
                <span className="min-w-0 flex-1">Get ready… starting in {count}. Your 20 seconds start after this.</span>
                <button onClick={() => setAi("off")} className="text-[12.5px] font-medium text-[#121821] underline-offset-4 hover:underline">
                  Cancel
                </button>
              </>
            )}
            {ai === "connecting" && <span className="flex-1">Connecting…</span>}
            {ai === "on" && (
              <>
                <span className={`min-w-0 flex-1 ${pieceError ? "text-[#a3261b]" : ""}`}>
                  {pieceError ?? "Showing your outfit. Change pieces in your closet to update it live."}
                </span>
                <button onClick={() => endAi()} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]">
                  Stop
                </button>
              </>
            )}
          </div>
        )}

        {/* After a session: replay and what to do with it. Nothing leaves this page unless chosen. */}
        {replay && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-[#f4f5f6] px-4 py-3 text-[12.5px] text-[#4f5b66]">
            {"url" in replay ? (
              <>
                <p>
                  {saveState === "saved"
                    ? "Replay of your live try-on."
                    : "Replay of your live try-on. It isn't saved unless you choose to, and is gone when you leave or start again."}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const v = replayVideoRef.current;
                      if (!v) return;
                      v.currentTime = 0;
                      v.play().catch(() => {});
                    }}
                    className="rounded-full bg-[#121821] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2a3542]"
                  >
                    Replay
                  </button>
                  <a
                    href={replay.url}
                    download={replay.file.name}
                    className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
                  >
                    Download video
                  </a>
                  <button
                    onClick={() => saveToVirm(replay.file)}
                    disabled={saveState === "saving" || saveState === "saved"}
                    className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)] disabled:opacity-60"
                  >
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved to Virm" : "Save to Virm"}
                  </button>
                  {typeof navigator !== "undefined" && navigator.canShare?.({ files: [replay.file] }) && (
                    <button
                      onClick={() => share(replay.file)}
                      className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
                    >
                      Share
                    </button>
                  )}
                  <button onClick={closeReplay} className="ml-auto text-[12.5px] font-medium text-[#121821] underline-offset-4 hover:underline">
                    Done
                  </button>
                </div>
                {!(typeof navigator !== "undefined" && navigator.canShare?.({ files: [replay.file] })) && (
                  <p className="text-[11.5px] text-[#5d6874]">Sharing isn&apos;t supported in this browser. Download the video to share it.</p>
                )}
                {shareNote && <p className="text-[11.5px] text-[#a3261b]">{shareNote}</p>}
                {saveState === "saved" && (
                  <p className="text-[11.5px] text-[#5d6874]">
                    Saved privately. Find it in <Link href="/outfits/saved" className="font-semibold text-[#121821] underline underline-offset-2">Saved Looks</Link>.
                  </p>
                )}
                {typeof saveState === "object" && <p className="text-[11.5px] text-[#a3261b]">{saveState.error}</p>}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex-1">{replay.failed}</span>
                <button onClick={closeReplay} className="text-[12.5px] font-medium text-[#121821] underline-offset-4 hover:underline">
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11.5px] leading-snug text-[#5d6874]">
          {TRY_ON_CAVEAT}
        </p>
        </div>
      </section>
  );
}
