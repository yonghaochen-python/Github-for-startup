"use client";

import { isRetiredDemo, type TrayItem } from "@/lib/shopCatalog";

/**
 * The Shopping wishlist: store finds saved on this device only (browser storage), with a small picture so they can
 * be tried on again. Nothing is sent to Virm's server.
 */

const KEY = "virm-shop-wishlist";
const MAX = 12;

export function readWishlist(): TrayItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.key === "string" && !isRetiredDemo(x.key)) : [];
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

/* ---------- Your shopping try-ons ---------- */

/**
 * Pieces the person added from another store (a link, or a photo when the link couldn't be read), kept on this
 * device so they're one tap from a try-on. Like the wishlist, nothing is sent to Virm's server.
 */
const TRY_ONS_KEY = "virm-shop-tryons";

export function readShopTryOns(): TrayItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(TRY_ONS_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.key === "string" && typeof x.imageUrl === "string") : [];
  } catch {
    return [];
  }
}

/** Keeps an added piece (newest first; the same piece once). Returns the new list. */
export function keepShopTryOn(item: TrayItem): TrayItem[] {
  const same = (x: TrayItem) => x.key === item.key || (item.productUrl !== null && x.productUrl === item.productUrl);
  let list = [item, ...readShopTryOns().filter((x) => !same(x))].slice(0, MAX);
  // Pictures are stored with the list; if the device runs out of room, keep fewer.
  while (list.length) {
    try {
      localStorage.setItem(TRY_ONS_KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return list;
}

export function removeShopTryOn(key: string): TrayItem[] {
  const list = readShopTryOns().filter((x) => x.key !== key);
  try {
    localStorage.setItem(TRY_ONS_KEY, JSON.stringify(list));
  } catch {}
  return list;
}
