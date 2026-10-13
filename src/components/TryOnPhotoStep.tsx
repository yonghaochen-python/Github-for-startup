"use client";

import { useEffect, useRef, useState } from "react";
import { photoToJpeg } from "@/lib/clientImage";

type Mode = "choose" | "camera" | "review";
type Source = "camera" | "upload";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const primaryButton =
  "btn-tactile touch-manipulation min-h-[48px] rounded-[5px] bg-[#242b30] px-6 py-3 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_4px_14px_#222d3422] hover:bg-[#3b4750] disabled:opacity-50";
const secondaryButton =
  "btn-tactile touch-manipulation min-h-[48px] rounded-[5px] border border-[#cbd3d7] bg-white/60 px-6 py-3 text-[13px] font-semibold text-[#333f46] hover:bg-[#e9edef] disabled:opacity-50";

/** On phones the actions stay pinned to the bottom edge (above the home indicator) so they never need a scroll. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-6 mt-4 border-t border-[#d9dfdf] bg-[#f6f9fa]/90 px-6 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-auto lg:max-w-[520px] lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none">
      <div className="flex gap-3">{children}</div>
    </div>
  );
}

/** Photo frame: 3:4, as large as fits above the action bar on a phone. */
const frameStyle = { height: "min(62dvh, calc((100vw - 3rem) * 4 / 3), 693px)", aspectRatio: "3 / 4" } as const;

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. You can allow it in your browser's site settings, or upload a photo instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "We couldn't find a camera on this device. You can upload a photo instead.";
  }
  if (name === "NotReadableError") {
    return "Your camera is busy in another app. Close it and try again, or upload a photo instead.";
  }
  return "We couldn't start the camera. You can upload a photo instead.";
}

/**
 * Step 1 of Try It On: get a photo of the person, either from the camera (only opened after an explicit
 * click) or an upload, let them retake/replace it, and hand the confirmed photo to the parent. Nothing here
 * is stored; the parent keeps the confirmed photo in memory for the session.
 */
export function TryOnPhotoStep({ onConfirm }: { onConfirm: (photo: Blob) => void }) {
  const [mode, setMode] = useState<Mode>("choose");
  const [source, setSource] = useState<Source>("upload");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function setPendingPhoto(blob: Blob | null) {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    if (!blob) {
      pendingUrlRef.current = null;
      setPending(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    pendingUrlRef.current = url;
    setPending({ blob, url });
  }

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    []
  );

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera here. You can upload a photo instead.");
      return;
    }
    setStarting(true);
    try {
      // Only now — after the person tapped "Take a Photo" — does the browser ask for permission.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      // If the system takes the camera away (call comes in, app switch, unplugged), fall back gracefully.
      stream.getTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          if (streamRef.current !== stream) return;
          stopCamera();
          setMode("choose");
          setError("The camera stopped. Tap Take a Photo to start it again, or upload a photo instead.");
        })
      );
      setCameraReady(false);
      setSource("camera");
      setMode("camera");
    } catch (err) {
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  // Attach the stream once the <video> element exists, and bring the frame to the top of the screen.
  useEffect(() => {
    if (mode !== "camera" && mode !== "review") return;
    if (mode === "camera") {
      const video = videoRef.current;
      if (video && streamRef.current) {
        video.srcObject = streamRef.current;
        video.play().catch(() => {});
      }
    }
    const frame = frameRef.current;
    if (frame) window.scrollTo({ top: Math.max(0, frame.getBoundingClientRect().top + window.scrollY - 12), behavior: "instant" });
  }, [mode]);

  function cancelCamera() {
    stopCamera();
    setMode("choose");
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    setError(null);
    try {
      // Match the preview (a centered 3:4 portrait crop) so the photo isn't wider than what the person framed.
      // Frames from the camera are already upright, including on phones; the photo is kept un-mirrored (true orientation)
      // even though the live preview is mirrored like a selfie.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const target = 3 / 4;
      const sw = vw / vh > target ? Math.round(vh * target) : vw;
      const sh = vw / vh > target ? vh : Math.round(vw / target);
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const raw = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("capture"))), "image/jpeg", 0.95)
      );
      setPendingPhoto(await photoToJpeg(raw));
      stopCamera();
      setMode("review");
    } catch {
      setError("Couldn't capture that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That photo is too large. Please use one under 25MB.");
      return;
    }
    setBusy(true);
    try {
      setPendingPhoto(await photoToJpeg(file));
      setSource("upload");
      setMode("review");
    } catch {
      setError("We couldn't read that photo. Try a JPG, PNG, or WebP image.");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setPendingPhoto(null);
    if (source === "camera") {
      startCamera();
    } else {
      setMode("choose");
      fileInputRef.current?.click();
    }
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="border border-[#d9dfdf] bg-white/70 p-6 sm:p-8">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">Step 1</p>
          <h2 className="font-display mb-3 text-[30px] font-normal leading-tight text-[#1c2328]">Add a photo of you</h2>
          <p className="mb-6 max-w-md text-sm leading-relaxed text-[#6c767b]">
            For best results, use a clear full-body photo with good lighting and your body fully visible.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={startCamera} disabled={starting || busy} className={`${primaryButton} sm:min-w-[160px]`}>
              {starting ? "Opening camera…" : "Take a Photo"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || busy}
              className={`${secondaryButton} sm:min-w-[160px]`}
            >
              {busy ? "Preparing photo…" : "Upload a Photo"}
            </button>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[#8b9087]">
            Your photo stays on this device while you try outfits and is never saved to your account.
          </p>
        </div>
      )}

      {mode === "camera" && (
        <div>
          <div
            ref={frameRef}
            style={frameStyle}
            className="relative mx-auto overflow-hidden border border-[#d9dfdf] bg-[#1c2328]"
          >
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={() => setCameraReady(true)}
              className="h-full w-full -scale-x-100 object-cover"
              style={{ objectFit: "cover" }}
            />
          </div>
          <p className="mx-auto mt-3 max-w-[520px] text-xs text-[#8b9087]">
            Step back so your whole body is in the frame, with good light on you.
          </p>
          <ActionBar>
            <button onClick={capture} disabled={busy || !cameraReady} className={`${primaryButton} flex-1`}>
              {busy ? "Capturing…" : cameraReady ? "Capture" : "Starting camera…"}
            </button>
            <button onClick={cancelCamera} disabled={busy} className={secondaryButton}>
              Cancel
            </button>
          </ActionBar>
        </div>
      )}

      {mode === "review" && pending && (
        <div>
          <div
            ref={frameRef}
            style={frameStyle}
            className="relative mx-auto overflow-hidden border border-[#d9dfdf] bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.url} alt="Your photo" className="h-full w-full object-contain" />
          </div>
          <ActionBar>
            <button onClick={() => onConfirm(pending.blob)} className={`${primaryButton} flex-1`}>
              Use this photo
            </button>
            <button onClick={retake} className={secondaryButton}>
              {source === "camera" ? "Retake" : "Choose another"}
            </button>
          </ActionBar>
        </div>
      )}
    </div>
  );
}
