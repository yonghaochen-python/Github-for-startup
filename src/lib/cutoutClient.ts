"use client";

import { cutOut } from "@/lib/cutout";

/** The person's choice for new pieces, remembered on this device. Background removal is on unless they turn it off. */
const PREF_KEY = "virm-remove-background";

export function removeBackgroundPreferred(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setRemoveBackgroundPreferred(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {}
}

type Item = { id: string; imageUrl: string };

/**
 * Removes a saved piece's background: cuts it out on this device and saves the cut-out. Returns the updated item, or
 * null if no clean cut-out was found (the photo stays as it is).
 */
export async function removeItemBackground<T extends Item>(item: T): Promise<T | null> {
  const photo = await fetch(item.imageUrl).then((r) => (r.ok ? r.blob() : null));
  if (!photo) return null;
  const cut = await cutOut(photo);
  if (!cut) return null;
  const form = new FormData();
  form.append("cutout", cut, "cutout.png");
  const res = await fetch(`/api/closet/items/${item.id}/background`, { method: "POST", body: form });
  if (!res.ok) return null;
  return ((await res.json()) as { item: T }).item;
}

/** Keep background: brings back the original photo. */
export async function keepItemBackground<T extends Item>(item: T): Promise<T | null> {
  const res = await fetch(`/api/closet/items/${item.id}/background`, { method: "DELETE" });
  if (!res.ok) return null;
  return ((await res.json()) as { item: T }).item;
}

/** After pieces are added: removes their backgrounds one at a time (if the person wants that), quietly. */
export async function removeBackgroundsAfterAdding<T extends Item>(items: T[], onDone: (item: T) => void): Promise<void> {
  if (!removeBackgroundPreferred()) return;
  for (const item of items) {
    const updated = await removeItemBackground(item).catch(() => null);
    if (updated) onDone(updated);
  }
}
