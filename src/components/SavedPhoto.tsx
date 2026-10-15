"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { TryOnPhotoStep } from "@/components/TryOnPhotoStep";

/** The signed-in person's saved try-on photo, read through the private, owner-only endpoint. */
export function SavedPhotoImage({ className = "", alt = "Your saved try-on photo" }: { className?: string; alt?: string }) {
  const { user } = useAuth();
  if (!user?.photoVersion) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/me/photo?v=${user.photoVersion}`} alt={alt} className={className} />;
}

/**
 * Choose/take a photo, preview it, and save it to the account only when the person presses "Save My Photo".
 * Replaces any previously saved photo.
 */
export function SavedPhotoSetup({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(photo: Blob) {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("photo", photo, "photo.jpg");
      const res = await fetch("/api/me/photo", { method: "PUT", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your photo right now. Please try again.");
      await refreshUser();
      showToast("Your try-on photo is saved");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your photo right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <TryOnPhotoStep onConfirm={save} saving={saving} onCancel={onCancel} />
    </div>
  );
}

/** Removes the saved photo after an explicit confirmation. */
export function useRemoveSavedPhoto() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  return async function removeSavedPhoto(): Promise<boolean> {
    if (!window.confirm("Remove your saved try-on photo? You can add a new one anytime.")) return false;
    const res = await fetch("/api/me/photo", { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't remove your photo. Please try again.");
      return false;
    }
    await refreshUser();
    showToast("Your try-on photo was removed");
    return true;
  };
}
