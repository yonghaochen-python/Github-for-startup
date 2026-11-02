"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CameraIcon } from "@/components/Icons";
import { ErrorNote, btnPrimary, btnSecondary, btnText } from "@/components/ui";
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
  savePortrait: (photo: Blob, fromTryOnPhoto?: boolean) => Promise<void>;
  removePortrait?: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const readiness = portraitReadiness(portrait?.checks ?? null);

  async function save(photo: Blob, fromTryOnPhoto = false) {
    setSaving(true);
    setError(null);
    try {
      await savePortrait(photo, fromTryOnPhoto);
    } catch (err) {
      setError(err instanceof Error && err.message !== "photo" ? err.message : "That photo couldn't be used. Try a JPG or PNG.");
    } finally {
      setSaving(false);
    }
  }

  async function useTryOnPhoto() {
    const photo = await fetch(`/api/me/photo?v=${user?.photoVersion}`)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    if (photo) await save(photo, true);
    else setError("Couldn't open your try-on photo. Upload a portrait instead.");
  }

  async function remove() {
    if (!removePortrait || !confirm("Remove your photo? Your finished reports stay.")) return;
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
          if (file) save(file);
        }}
      />
      {/* Only a problem with the photo is worth a line; a good photo needs no words. */}
      {portrait && !readiness.ready && <p className="text-[13px] text-amber-800">⚠ {readiness.note}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button onClick={() => fileInput.current?.click()} disabled={saving} className={portrait && readiness.ready ? btnSecondary : btnPrimary}>
          <CameraIcon className="h-4 w-4" /> {saving ? "Checking…" : portrait ? "Change photo" : "Upload a photo"}
        </button>
        {!portrait && user?.photoVersion && !saving && (
          <button onClick={useTryOnPhoto} className={btnText}>
            Use my try-on photo
          </button>
        )}
        {portrait && removePortrait && (
          <button onClick={remove} className={`${btnText} text-[#5d6874]`}>
            Remove
          </button>
        )}
      </div>
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
    </div>
  );
}
