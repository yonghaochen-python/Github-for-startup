"use client";

import { useState } from "react";
import Link from "next/link";
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
 * What the person's virtual mirror shows: their current look (latest try-on) if they have one, otherwise
 * their saved photo. The look stays until they try something else, take it off, or change the photo.
 */
export function MirrorImage({ className = "", original = false }: { className?: string; original?: boolean }) {
  const { user } = useAuth();
  if (!user?.photoVersion) return null;
  if (user.look && !original) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/me/look?v=${user.look.version}`} alt="You wearing your current look" className={className} />;
  }
  return <SavedPhotoImage className={className} />;
}

/** Takes off the current look, so the plain saved photo shows again. */
export function useTakeOffLook() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  return async function takeOffLook(): Promise<boolean> {
    const res = await fetch("/api/me/look", { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't take off this look. Please try again.");
      return false;
    }
    await refreshUser();
    showToast("Look taken off");
    return true;
  };
}

/** The two manual changes to the current look: open that outfit, or take the look off. */
export function CurrentLookBar({ dark = false }: { dark?: boolean }) {
  const { user } = useAuth();
  const takeOffLook = useTakeOffLook();
  if (!user?.look) return null;
  const muted = dark ? "text-[#c3cdd2]" : "text-[#4f5b66]";
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${muted}`}>
      <Link href={`/outfits/${user.look.outfitId}`} className={`font-semibold underline-offset-4 hover:underline ${dark ? "text-white" : "text-[#121821]"}`}>
        View this outfit
      </Link>
      <button onClick={takeOffLook} className="underline-offset-4 hover:underline">
        Take it off
      </button>
    </div>
  );
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
      showToast("Photo saved");
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
        <p role="alert" className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
    showToast("Photo removed");
    return true;
  };
}
