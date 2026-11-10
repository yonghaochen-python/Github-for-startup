"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useAuth } from "@/components/AuthProvider";
import { CameraIcon } from "@/components/Icons";
import { ErrorNote, btnPrimary, btnSecondary, btnText } from "@/components/ui";
import { SelfieCamera } from "@/components/studio/SelfieCamera";
import { cropPortrait } from "@/lib/portraitCheck";
import { portraitReadiness, type PortraitInfo } from "@/lib/studioModules";

export const PHOTO_TIPS = ["Head and shoulders, facing the camera", "Daylight, like near a window", "No filters, hair out of your face"];

/**
 * Adding or changing the AI Stylist portrait, with whether it's good enough and what to change if not. Used on the
 * AI Stylist page and on each analysis, so a photo that doesn't work can be swapped right there.
 */
export function PortraitControls({
  portrait,
  savePortrait,
  removePortrait,
}: {
  portrait: PortraitInfo | null;
  savePortrait: (photo: Blob, fromTryOnPhoto?: boolean) => Promise<PortraitInfo | void>;
  removePortrait?: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [camera, setCamera] = useState(false);
  // The photo chosen but not saved yet: shown first, saved only on "Use this photo".
  const [pending, setPending] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);
  const preview = (blob: Blob) => {
    setError(null);
    setPending({ blob, url: URL.createObjectURL(blob) });
  };
  const readiness = portraitReadiness(portrait?.checks ?? null);

  async function save(photo: Blob, fromTryOnPhoto = false) {
    setSaving(true);
    setError(null);
    try {
      await savePortrait(photo, fromTryOnPhoto);
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message !== "photo" ? err.message : "That photo couldn't be used. Try a JPG or PNG.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function useTryOnPhoto() {
    const photo = await fetch(`/api/me/photo?v=${user?.photoVersion}`)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    // Zoomed in on the face first, so the preview shows what will be analyzed.
    const face = photo ? await cropPortrait(photo).catch(() => null) : null;
    if (face) preview(face);
    else setError(photo ? "We couldn't find your face in your Studio photo. Take a selfie instead." : "Couldn't open your Studio photo. Take a selfie instead.");
  }

  async function zoomIn() {
    const current = await fetch(`/api/studio/portrait?v=${portrait?.version}`)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    if (!current) return setError("Couldn't open your photo. Please try again.");
    setSaving(true);
    setError(null);
    try {
      const saved = await savePortrait(current);
      if (saved && saved.checks?.face !== "clear") setError("Your face couldn't be zoomed in clearly. Try a head-and-shoulders photo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't zoom in. Try a head-and-shoulders photo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removePortrait) return;
    try {
      await removePortrait();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove it. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) preview(file);
        }}
      />
      {/* Only a problem with the photo is worth a line; a good photo needs no words. */}
      {portrait && !readiness.ready && <p className="text-[13px] text-amber-800">⚠ {readiness.note}</p>}
      {/* A full-body photo already saved: zoom in on the face right here instead of choosing a new one. */}
      {portrait && portrait.checks?.face === "small" && !saving && (
        <button onClick={zoomIn} className={`${btnPrimary} self-start`}>
          Zoom in on my face
        </button>
      )}
      {/* The chosen photo, before it's used: nothing is saved (or analyzed) until "Use this photo". */}
      {pending && (
        <div className="flex items-center gap-4 rounded-[18px] bg-white p-3 shadow-[0_8px_22px_rgba(18,30,45,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.url} alt="The photo you chose" className="h-28 w-[88px] shrink-0 rounded-[12px] object-cover" />
          <div className="flex min-w-0 flex-col items-start gap-2">
            <button
              onClick={async () => {
                // Kept on screen if it can't be used, with the reason below.
                if (await save(pending.blob)) setPending(null);
              }}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? "Checking…" : "Use this photo"}
            </button>
            {!saving && (
              <button onClick={() => setPending(null)} className={btnText}>
                Choose another
              </button>
            )}
          </div>
        </div>
      )}
      {!pending && (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* A selfie right here (no trip to Studio), a photo from the phone, or the Studio photo. */}
        <button onClick={() => setCamera(true)} disabled={saving} className={portrait && (readiness.ready || portrait.checks?.face === "small") ? btnSecondary : btnPrimary}>
          <CameraIcon className="h-4 w-4" /> {saving ? "Checking…" : portrait ? "Retake" : "Take a selfie"}
        </button>
        {!saving && (
          <button onClick={() => fileInput.current?.click()} className={btnText}>
            Upload
          </button>
        )}
        {user?.photoVersion && !saving && (
          <button onClick={useTryOnPhoto} className={btnText}>
            Use Studio photo
          </button>
        )}
        {portrait && removePortrait && (
          <ConfirmButton label="Remove" question="Remove your photo? Reports stay." confirmLabel="Remove" onConfirm={remove} className={`${btnText} text-[#5d6874]`} />
        )}
      </div>
      )}
      {/* Tips only before there's a photo. */}
      {!portrait && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5d6874]">
          {PHOTO_TIPS.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[#9aa4ad]" /> {t}
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorNote message={error} />}
      {camera && (
        <SelfieCamera
          onClose={() => setCamera(false)}
          onPhoto={(photo) => {
            setCamera(false);
            preview(photo);
          }}
        />
      )}
    </div>
  );
}
