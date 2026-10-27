"use client";

import { useEffect, useRef, useState } from "react";
import { photoToJpeg } from "@/lib/clientImage";
import { frameToBody, preloadAutoFrame } from "@/lib/autoFrame";

type Mode = "choose" | "camera" | "review";
type Source = "camera" | "upload";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const primaryButton =
  "btn-tactile touch-manipulation min-h-[48px] rounded-full bg-[#121821] px-6 py-3 text-[14px] font-medium text-white hover:bg-[#2a3542] disabled:opacity-50";
const secondaryButton =
  "btn-tactile touch-manipulation min-h-[48px] rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)] disabled:opacity-50";

/** On phones the actions stay pinned just above the bottom tab bar so they never need a scroll. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-5 mt-4 border-t border-black/[0.07] bg-[#f6f9fa]/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8 md:bottom-0 md:pb-[max(12px,env(safe-area-inset-bottom))] lg:static lg:mx-auto lg:max-w-[520px] lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none">
      <div className="flex gap-3">{children}</div>
    </div>
  );
}

/** Photo frame: 3:4, as large as fits above the action bar and tab bar on a phone. */
const frameStyle = { height: "min(56dvh, calc((100vw - 2.5rem) * 4 / 3), 640px)", aspectRatio: "3 / 4" } as const;

const PHOTO_TIPS = [
  "Your whole body, head to feet, in the frame",
  "Facing the camera, arms relaxed at your sides",
  "Good, even light and a plain background",
  "Fitted, simple clothes work best",
];

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
 * Gets the person's full-body try-on photo, either from the camera (only opened after an explicit click) or
 * an upload, and hands it to the parent to save as soon as it's picked or captured (no extra "save" click). The
 * preview stays on screen while it saves; if saving fails, "Save My Photo" is there to try again.
 */
export function TryOnPhotoStep({
  onConfirm,
  saving = false,
  onCancel,
  onPendingChange,
}: {
  onConfirm: (photo: Blob) => void;
  saving?: boolean;
  onCancel?: () => void;
  /** Told about the chosen photo before it's saved (and null when it's dropped), so a parent can save it itself. */
  onPendingChange?: (photo: Blob | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [source, setSource] = useState<Source>("upload");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  // When the photo was cropped to fit the person, the uncropped version is kept so they can switch back.
  const [framing, setFraming] = useState<{ cropped: Blob; original: Blob; useCropped: boolean } | null>(null);
  const [frameNote, setFrameNote] = useState<string | null>(null);

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
    onPendingChange?.(blob);
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
      stopCamera();
      const photo = await preparePhoto(raw);
      setMode("review");
      onConfirm(photo);
    } catch {
      setError("Couldn't capture that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Start fetching the body-detection model while the person picks a photo.
  useEffect(() => preloadAutoFrame(), []);

  /** Prepares a chosen or captured photo: crops it head to toe when the feet are in it, otherwise keeps it as is. */
  async function preparePhoto(raw: Blob): Promise<Blob> {
    const [original, firstTry] = await Promise.all([photoToJpeg(raw), frameToBody(raw)]);
    // Some photos (like iPhone HEIC) can't be read directly for framing; the converted copy always can.
    const frame = firstTry.framed === false && firstTry.reason === "unavailable" ? await frameToBody(original) : firstTry;
    if (frame.framed) {
      const cropped = await photoToJpeg(frame.blob);
      setFraming({ cropped, original, useCropped: true });
      setFrameNote(null);
      setPendingPhoto(cropped);
      return cropped;
    } else {
      setFraming(null);
      setFrameNote(frame.reason === "no-feet" ? "Your feet aren't in this photo, so it's kept as it is." : null);
      setPendingPhoto(original);
      return original;
    }
  }

  function toggleCrop() {
    if (!framing) return;
    const useCropped = !framing.useCropped;
    setFraming({ ...framing, useCropped });
    setPendingPhoto(useCropped ? framing.cropped : framing.original);
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
      const photo = await preparePhoto(file);
      setSource("upload");
      setMode("review");
      onConfirm(photo);
    } catch {
      setError("We couldn't read that photo. Try a JPG, PNG, or WebP image.");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setPendingPhoto(null);
    setFraming(null);
    setFrameNote(null);
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
        <p role="alert" className="mb-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="grid gap-6 overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]/70 p-5 sm:p-8 md:grid-cols-[minmax(0,240px)_1fr] md:gap-10">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={starting || busy}
            className="group flex aspect-[3/4] w-full max-w-[240px] flex-col items-center justify-center gap-3 justify-self-center rounded-[22px] border border-dashed border-[#aab6bc] bg-[#f4f7f8] text-[#5b676d] transition-colors hover:border-[#121821] hover:bg-white md:justify-self-start"
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden>
              <circle cx="12" cy="5.5" r="2.5" />
              <path d="M8 21v-6.5L6.5 10a1.5 1.5 0 0 1 1.4-2h8.2a1.5 1.5 0 0 1 1.4 2L16 14.5V21M12 14v7" />
            </svg>
            <span className="text-[12px] font-semibold">{busy ? "Preparing photo…" : "Choose a full-body photo"}</span>
          </button>
          <div>
            <h2 className="font-display mb-2 text-[30px] font-normal leading-tight text-[#121821]">Your personal try-on photo</h2>
            <p className="mb-5 max-w-md text-[13.5px] leading-relaxed text-[#4f5b66]">
              A clear, full-body photo. You&apos;ll use it for every try-on.
            </p>
            <ul className="mb-6 grid gap-2 text-[12.5px] text-[#4f5a60]">
              {PHOTO_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#7e888e]" />
                  {tip}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={starting || busy}
                className={`${primaryButton} sm:min-w-[160px]`}
              >
                {busy ? "Preparing photo…" : "Choose Photo"}
              </button>
              <button onClick={startCamera} disabled={starting || busy} className={`${secondaryButton} sm:min-w-[160px]`}>
                {starting ? "Opening camera…" : "Take a Photo"}
              </button>
              {onCancel && (
                <button onClick={onCancel} className="px-2 text-[12px] font-semibold text-[#4f5b66] underline-offset-4 hover:underline">
                  Cancel
                </button>
              )}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-[#5d6874]">
              Your photo is saved as soon as you pick it. Only you can see it, and you can change it anytime.
            </p>
          </div>
        </div>
      )}

      {mode === "camera" && (
        <div>
          <div
            ref={frameRef}
            style={frameStyle}
            className="relative mx-auto overflow-hidden rounded-[22px] bg-[#121821]"
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
          <p className="mx-auto mt-3 max-w-[520px] text-xs text-[#5d6874]">
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
            className="relative mx-auto overflow-hidden overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.url} alt="Your photo" className="h-full w-full object-contain" />
          </div>
          <p className="mx-auto mt-3 flex max-w-[520px] flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5d6874]">
            {framing ? (
              <>
                <span>{framing.useCropped ? "Cropped to fit you, head to toe." : "Showing your original photo."}</span>
                <button onClick={toggleCrop} disabled={saving} className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                  {framing.useCropped ? "Use original" : "Use cropped"}
                </button>
              </>
            ) : (
              (frameNote ?? "Make sure your whole body is visible.")
            )}
          </p>
          <ActionBar>
            <button onClick={() => onConfirm(pending.blob)} disabled={saving} className={`${primaryButton} flex-1`}>
              {saving ? "Saving your photo…" : "Save My Photo"}
            </button>
            <button onClick={retake} disabled={saving} className={secondaryButton}>
              {source === "camera" ? "Retake" : "Choose another"}
            </button>
          </ActionBar>
        </div>
      )}
    </div>
  );
}
