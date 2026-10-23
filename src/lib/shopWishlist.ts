"use client";

import type { TrayItem } from "@/lib/shopCatalog";

/**
 * The Shopping wishlist: store finds saved on this device only (browser storage), with a small picture so they can
 * be tried on again. Nothing is sent to Virm's server.
 */

const KEY = "virm-shop-wishlist";
const MAX = 12;

export function readWishlist(): TrayItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.key === "string") : [];
  } catch {
    return [];
  }
}

/** Saves a find (newest first; the same store page is kept once). Returns false if the device has no room. */
export function addToWishlist(item: TrayItem): boolean {
  const same = (x: TrayItem) => x.key === item.key || (item.productUrl !== null && x.productUrl === item.productUrl);
  const list = [item, ...readWishlist().filter((x) => !same(x))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function removeFromWishlist(key: string): TrayItem[] {
  const list = readWishlist().filter((x) => x.key !== key);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return list;
}
