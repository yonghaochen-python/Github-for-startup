"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A full-screen front camera for the AI Stylist photo: one round button takes the selfie. The browser only asks for
 * the camera once this opens; nothing is uploaded until the photo is taken (and then only through onPhoto).
 */
export function SelfieCamera({ onPhoto, onClose }: { onPhoto: (photo: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError("This browser can't open the camera. Upload a photo instead.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(denied ? "Camera access is off. Allow it in your browser, or upload a photo instead." : "The camera couldn't open. Upload a photo instead.");
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d")!;
    // Saved the way the preview looks (mirrored, like a selfie).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && onPhoto(blob), "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black" role="dialog" aria-label="Take a selfie">
      <div className="relative min-h-0 flex-1">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {/* Where the face goes. */}
        {ready && <div className="pointer-events-none absolute left-1/2 top-[42%] aspect-[3/4] w-[min(62vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/70" />}
        {error && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[15px] text-white">{error}</p>}
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-[22px] text-white"
        >
          ×
        </button>
      </div>
      <div className="flex justify-center bg-black py-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button
          onClick={snap}
          disabled={!ready}
          aria-label="Take the photo"
          className="h-[72px] w-[72px] rounded-full border-4 border-white bg-white/90 transition active:scale-95 disabled:opacity-40"
        />
      </div>
    </div>
  );
}
