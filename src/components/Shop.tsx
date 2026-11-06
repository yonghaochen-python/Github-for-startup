"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LIVE_SHOP_KEY,
  SHOP_OUTFIT_KEY,
  isRetiredDemo,
  SHOP_PRODUCTS,
  SUGGESTED_SEARCHES,
  shopPiece,
  trayItemFrom,
  type ShopProduct,
  type TrayItem,
} from "@/lib/shopCatalog";
import { addToWishlist, keepShopTryOn, readShopTryOns, readWishlist, removeFromWishlist, removeShopTryOn } from "@/lib/shopWishlist";
import { StoreFinder } from "@/components/StoreFinder";
import { ProductDetail } from "@/components/ProductDetail";
import { Dialog } from "@/components/Dialog";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { Tips, type Tip } from "@/components/Tips";

const SHOP_TIPS: Tip[] = [
  { target: 'input[aria-label="Search the collection"]', text: "Search clothes, brands or styles." },
  { target: "#collection li button[aria-pressed]", text: "Tap pieces to build an outfit." },
  { target: '[data-tip="shop-add"]', text: "Add a piece from any store." },
  { target: '[data-tip="shop-edit"]', text: "Edit to save pieces to your wishlist." },
];

/**
 * Shopping: browse the catalog, open a piece to see it up close and try it on (live, or on your saved photo), or
 * import one from any store. Pieces added to "Your outfit" (up to six, several of a kind allowed) open on Live
 * together. The ♡ saves to the wishlist. Nothing is sold here and nothing is added to My Closet. The catalog holds
 * clearly labelled demo items until real, properly sourced listings are added (see lib/shopCatalog).
 */

const TABS = [
  { value: "all", label: "All" },
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

const SLOT_NAMES: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
  outfit: "Whole outfit",
};

// Hearts used to be kept apart from the wishlist; they're one list now, so the old key is cleared.
const OLD_LOVED_KEY = "virm-shop-loved";
// "Your outfit" is kept on this device too, so it's still there after visiting Studio (which lists it first too).
const OUTFIT_KEY = SHOP_OUTFIT_KEY;

function keepOutfit(list: TrayItem[]) {
  try {
    localStorage.setItem(OUTFIT_KEY, JSON.stringify(list));
  } catch {}
}
const MAX_TRAY = 6;


function Spark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4l5.5 1.6-5.5 1.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9z" />
    </svg>
  );
}

const label = "text-[10.5px] font-medium uppercase tracking-[2px] text-[#5d6874]";

export function Shop() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [, setTab] = useState("all");
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [wishlist, setWishlist] = useState<TrayItem[]>([]);
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const [importing, setImporting] = useState(false);
  // Swap: the outfit piece being replaced; the next piece picked takes its place.
  const [swapping, setSwapping] = useState<TrayItem | null>(null);
  // Phones: the outfit sits in a slim bar at the bottom; this opens its list.
  const [outfitOpen, setOutfitOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  // Edit: shows the ♡ and + on every piece for quick changes; otherwise a tap opens the piece.
  const [editMode, setEditMode] = useState(false);
  // Pieces added from other stores, kept on this device.
  const [myTryOns, setMyTryOns] = useState<TrayItem[]>([]);
  // The try-on piece whose card is open.
  const [piece, setPiece] = useState<TrayItem | null>(null);
  // The wishlist and "Your outfit" are remembered on this device only.
  useEffect(() => {
    try {
      localStorage.removeItem(OLD_LOVED_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
    setWishlist(readWishlist());
    setMyTryOns(readShopTryOns());
    try {
      const outfit = JSON.parse(localStorage.getItem(OUTFIT_KEY) ?? "[]");
      if (Array.isArray(outfit)) {
        setTray(outfit.filter((x) => x && typeof x.key === "string" && typeof x.imageUrl === "string" && !isRetiredDemo(x.key)).slice(0, MAX_TRAY));
      }
    } catch {}
  }, []);

  const isSaved = (key: string) => wishlist.some((w) => w.key === key);

  /** The ♡: saves a catalog piece to the wishlist, or takes it out. */
  function toggleSaved(p: ShopProduct) {
    if (isSaved(p.id)) setWishlist(removeFromWishlist(p.id));
    else {
      addToWishlist(trayItemFrom(p));
      setWishlist(readWishlist());
    }
  }

  /** Ends a swap: every row shows again. */
  function stopSwap() {
    setSwapping(null);
    setTab("all");
  }

  /** Adds a piece to the tray, or takes it out (up to MAX_TRAY pieces). */
  function toggleTray(item: TrayItem) {
    const replacing = swapping && swapping.key !== item.key ? swapping : null;
    if (swapping) stopSwap();
    setTray((list) => {
      const inList = list.some((p) => p.key === item.key);
      const next = replacing && !inList
        ? list.map((p) => (p.key === replacing.key ? item : p))
        : inList
          ? list.filter((p) => p.key !== item.key)
          : list.length >= MAX_TRAY
            ? list
            : [...list, item];
      keepOutfit(next);
      return next;
    });
  }

  /** Swap: show that kind of piece, so the next one picked replaces it. */
  function startSwap(item: TrayItem) {
    setSwapping(item);
    setOutfitOpen(false);
    setTab(TABS.some((t) => t.value === item.category) ? item.category : "all");
    setQuery("");
    requestAnimationFrame(() => document.getElementById("collection-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** Catalog pieces whose picture isn't suitable for try-on (they can't be sent to Studio). */
  const unsuitable = (items: TrayItem[]) => items.filter((t) => SHOP_PRODUCTS.find((p) => p.id === t.key)?.tryOnEligible === false);

  /** Opens the Studio with the outfit (plus one more piece, when trying one straight away), in Photo or Live. */
  function tryInStudio(extra?: TrayItem, mode: "photo" | "live" = "photo") {
    const pieces = extra && !tray.some((p) => p.key === extra.key) ? [...tray, extra].slice(-MAX_TRAY) : tray;
    if (!pieces.length || unsuitable(pieces).length) return;
    try {
      sessionStorage.setItem(LIVE_SHOP_KEY, JSON.stringify(pieces.map(shopPiece)));
    } catch {}
    router.push(`/studio?shop=1${mode === "live" ? "&mode=live" : ""}`);
  }

  /** Saves a store find to this device's wishlist (with a smaller picture so a dozen fit). */
  function saveFind(item: TrayItem): boolean {
    const ok = addToWishlist(item);
    setWishlist(readWishlist());
    return ok;
  }

  const inTray = new Set(tray.map((p) => p.key));

  const blocked = unsuitable(tray);

  /** The outfit list and its actions, shared by the side panel and the phone bar. */
  function outfitPanel() {
    return (
      <>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#121821]">Your outfit</p>
            <p className="text-[11px] text-[#5d6874]">
              {tray.length} selected{tray.length >= MAX_TRAY ? " (the most)" : ""}
            </p>
          </div>
          {tray.length > 0 && (
            <button
              onClick={() => {
                setTray([]);
                keepOutfit([]);
                stopSwap();
              }}
              className="text-[11px] text-[#5d6874] underline-offset-4 hover:text-[#121821] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {tray.length === 0 ? (
          <p className="mt-4 border-t border-black/[0.07] pt-4 text-[12px] leading-snug text-[#5d6874]">
            Tap pieces to add them.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3 border-t border-black/[0.07] pt-4">
            {tray.map((p) => (
              <li key={p.key} className={`flex items-center gap-3 ${swapping?.key === p.key ? "opacity-50" : ""}`}>
                <span className="relative h-14 w-11 shrink-0 overflow-hidden bg-[#f0eee9]">
                  <Image src={p.imageUrl} alt="" fill unoptimized className="p-1" style={{ objectFit: "contain" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9.5px] uppercase tracking-[1.6px] text-[#5d6874]">
                    {SLOT_NAMES[p.category]}
                    {(p.productUrl || p.key.startsWith("ext-")) && p.label ? ` · ${p.label}` : ""}
                  </span>
                  <span className="block truncate text-[12.5px] font-medium text-[#121821]">{p.name}</span>
                </span>
                <button onClick={() => startSwap(p)} className="text-[11px] font-semibold text-[#121821] underline-offset-4 hover:underline">
                  Swap
                </button>
                <button onClick={() => toggleTray(p)} aria-label={`Remove ${p.name}`} className="p-1 text-[#5d6874] hover:text-[#c23a2c]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {blocked.length > 0 && (
          <p className="mt-3 rounded-[4px] bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
            {blocked.map((b) => b.name).join(", ")} can&apos;t be tried on (its picture isn&apos;t suitable). Remove it to continue.
          </p>
        )}
        <button
          onClick={() => tryInStudio()}
          disabled={tray.length === 0 || blocked.length > 0}
          className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[2px] bg-[#121821] text-[12.5px] font-medium text-white hover:bg-[#2a3542] disabled:bg-[#c9cdd0]"
        >
          <Spark className="h-3.5 w-3.5" /> Try on in Studio
        </button>
      </>
    );
  }

  const keepTryOn = (item: TrayItem) => setMyTryOns(keepShopTryOn(item));
  const searchWords = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const myTryOnsShown = myTryOns.filter((t) => {
    const text = `${t.name} ${t.label} ${t.color} ${t.category}`.toLowerCase();
    return searchWords.every((w) => text.includes(w.replace(/s$/, "")));
  });

  const pickedRing = (selected: boolean) => (selected ? "ring-2 ring-[#121821] ring-offset-2 ring-offset-transparent" : "");

  /** One of Your Shopping Try-Ons: a tap opens its card (Add to Studio); Edit shows remove. */
  function renderTryOn(t: TrayItem) {
    const selected = inTray.has(t.key);
    return (
      <li key={t.key} className="relative min-w-0">
        <button onClick={() => setPiece(t)} aria-label={`Open ${t.name}`} className={`group block w-full text-left ${editMode ? "animate-[wiggle_0.6s_ease-in-out_infinite]" : ""}`}>
          <span className={`relative block aspect-[3/4] overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(18,30,45,0.06)] ${pickedRing(selected)}`}>
            <Image src={t.imageUrl} alt="" fill unoptimized className="object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          </span>
          {t.label && <span className="mt-2.5 block truncate text-[10px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">{t.label}</span>}
          <span className={`block truncate text-[13px] font-medium text-[#121821] ${t.label ? "" : "mt-2.5"}`}>{t.name}</span>
          {t.price && <span className="block text-[12px] text-[#5d6874]">{t.price}</span>}
        </button>
        {editMode && (
          <button
            onClick={() => setMyTryOns(removeShopTryOn(t.key))}
            aria-label={`Remove ${t.name}`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#121821] text-[11px] text-white shadow"
          >
            ✕
          </button>
        )}
        {selected && (
          <span aria-hidden className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-[11px] text-white shadow-sm">
            ✓
          </span>
        )}
      </li>
    );
  }

  /** Opens Studio with this one piece added to the look there (no AI until Try On is pressed). */
  function addToStudio(t: TrayItem) {
    try {
      sessionStorage.setItem(LIVE_SHOP_KEY, JSON.stringify([shopPiece(t)]));
    } catch {}
    router.push("/studio?shop=1&add=1");
  }

  return (
    <>
      <Tips id="shop" tips={SHOP_TIPS} delay={1200} />
      <section id="collection" className={`mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-8 sm:px-6 ${tray.length ? "pb-32 lg:pb-16" : "pb-16"}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[44px] leading-none tracking-[-1px] text-[#121821] sm:text-[52px]">Shopping</h1>
          <div className="flex items-center gap-2">
            {/* Add: bring in a piece from any store. */}
            <button onClick={() => setImporting((v) => !v)} aria-expanded={importing} data-tip="shop-add" className={btnPrimary}>
              {importing ? "Close" : <><span className="text-[16px] font-light leading-none">+</span> Add</>}
            </button>
            <button onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} data-tip="shop-edit" className={btnSecondary}>
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {wishlist.length > 0 && (
          <div className="mt-6">
            <p className={label}>Your wishlist</p>
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {wishlist.map((w) => {
                const added = tray.some((p) => p.key === w.key);
                return (
                  <li key={w.key} className="w-[150px] shrink-0 rounded-[6px] bg-white p-2.5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_8px_22px_rgba(18,30,45,0.05)]">
                    <button
                      onClick={() => setOpen(SHOP_PRODUCTS.find((p) => p.id === w.key) ?? null)}
                      disabled={!SHOP_PRODUCTS.some((p) => p.id === w.key)}
                      aria-label={`Open ${w.name}`}
                      className="relative block aspect-[3/4] w-full overflow-hidden bg-[#f0eee9] disabled:cursor-default"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a picture saved on this device */}
                      <img src={w.imageUrl} alt={w.name} className="absolute inset-0 h-full w-full object-contain p-1.5" />
                    </button>
                    <p className="mt-2 truncate text-[9.5px] uppercase tracking-[1.4px] text-[#5d6874]">{w.label || "Store find"}</p>
                    <p className="truncate text-[12.5px] font-medium text-[#121821]">{w.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px]">
                      <button onClick={() => toggleTray(w)} disabled={!added && tray.length >= MAX_TRAY} className="font-semibold text-[#121821] underline-offset-4 hover:underline disabled:opacity-40">
                        {added ? "In outfit" : "Add"}
                      </button>
                      {w.productUrl && (
                        <a href={w.productUrl} target="_blank" rel="noopener noreferrer" className="text-[#121821] underline-offset-4 hover:underline">
                          Store ↗
                        </a>
                      )}
                      <button onClick={() => setWishlist(removeFromWishlist(w.key))} className="text-[#5d6874] underline-offset-4 hover:underline">
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <div className="min-w-0">
          <div className="flex items-center gap-4">
          <label className="flex min-w-0 max-w-md flex-1 items-center gap-3 border-b border-black/15 pb-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#5d6874]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search clothes, brands, or styles…"
              aria-label="Search the collection"
              className="w-full bg-transparent text-[13px] text-[#121821] outline-none placeholder:text-[#7d8790]"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-[14px] leading-none text-[#5d6874] hover:text-[#121821]">
                ×
              </button>
            )}
          </label>
          </div>
          {!query && searchFocused && SUGGESTED_SEARCHES.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[11.5px] text-[#5d6874]">
              <span className="mr-1">Try</span>
              {SUGGESTED_SEARCHES.slice(0, 4).map((s) => (
                <button key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery(s)} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] text-[#26313a] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]">
                  {s}
                </button>
              ))}
            </p>
          )}
          </div>
        </div>

        {importing && (
          <div className="mt-5">
            {/* Whatever is done with an added piece, it's also kept in "Your shopping try-ons". */}
            <StoreFinder
              onTryNow={(item) => {
                keepTryOn(item);
                tryInStudio(item);
              }}
              onAdd={(item) => {
                keepTryOn(item);
                toggleTray(item);
              }}
              onSave={(item) => {
                keepTryOn(item);
                return saveFind(item);
              }}
              trayFull={tray.length >= MAX_TRAY}
            />
          </div>
        )}

        <div id="collection-grid" className="mt-6 grid scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {swapping && (
              <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-[#121821] px-4 py-3 text-[12.5px] text-white">
                <span className="flex-1">
                  Pick a replacement for <b>{swapping.name}</b>.
                </span>
                <button onClick={() => stopSwap()} className="font-semibold underline underline-offset-4">
                  Cancel
                </button>
              </div>
            )}
            <section aria-labelledby="tryons-title">
              <h2 id="tryons-title" className="mb-5 font-display text-[30px] font-normal leading-none tracking-[-0.5px] text-[#121821] sm:text-[38px]">
                Your Shopping Try-Ons {myTryOns.length > 0 && <span className="ml-1 font-sans text-[14px] tracking-normal text-[#5d6874]">{myTryOnsShown.length}</span>}
              </h2>
              {myTryOns.length === 0 ? (
                <button onClick={() => setImporting(true)} className={btnPrimary}>
                  <span className="text-[16px] font-light leading-none">+</span> Add a piece
                </button>
              ) : (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">{myTryOnsShown.map(renderTryOn)}</ul>
              )}
            </section>

          </div>

          {/* Your outfit: beside the grid on wide screens (a bar at the bottom on phones, below). */}
          <aside aria-label="Your outfit" className="hidden self-start rounded-[6px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:sticky lg:top-24 lg:block">
            {outfitPanel()}
          </aside>
        </div>
      </section>

      {/* Phones and tablets: the outfit as a slim bar above the tab bar; tap to open its list. */}
      {tray.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-3 pb-2 md:bottom-0 lg:hidden">
          {outfitOpen && (
            <div className="mb-2 max-h-[55vh] overflow-y-auto rounded-[10px] bg-white p-4 shadow-[0_-8px_30px_rgba(18,30,45,0.18)]">{outfitPanel()}</div>
          )}
          <div className="flex items-center gap-3 rounded-[10px] bg-[#121821] px-3 py-2.5 text-white shadow-[0_8px_30px_rgba(18,30,45,0.25)]">
            <button onClick={() => setOutfitOpen((v) => !v)} aria-expanded={outfitOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="flex -space-x-2">
                {tray.slice(0, 3).map((p) => (
                  <span key={p.key} className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-[#121821] bg-[#f0eee9]">
                    <Image src={p.imageUrl} alt="" fill unoptimized className="p-0.5" style={{ objectFit: "contain" }} />
                  </span>
                ))}
              </span>
              <span className="truncate text-[12.5px] font-medium">
                Your outfit · {tray.length} {outfitOpen ? "▾" : "▴"}
              </span>
            </button>
            <button
              onClick={() => tryInStudio()}
              disabled={blocked.length > 0}
              className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-[#121821] disabled:opacity-50"
            >
              Try on in Studio
            </button>
          </div>
        </div>
      )}

      {piece && (
        <Dialog label={piece.name} onClose={() => setPiece(null)} className="w-full max-w-[420px] overflow-hidden rounded-[26px] bg-white shadow-[0_40px_90px_rgba(0,0,0,0.3)]">
          <div className="relative aspect-[4/5] max-h-[52vh] w-full bg-[#f6f5f2]">
            <Image src={piece.imageUrl} alt={piece.name} fill unoptimized className="object-contain p-6" />
            <button onClick={() => setPiece(null)} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[15px] text-[#121821] shadow-sm backdrop-blur">
              ✕
            </button>
          </div>
          <div className="p-5">
            {piece.label && <p className="text-[10.5px] font-semibold uppercase tracking-[1.8px] text-[#5d6874]">{piece.label}</p>}
            <p className="mt-1 font-display text-[26px] leading-tight text-[#121821]">{piece.name}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-[#5d6874]">
              {piece.price && <span>{piece.price}</span>}
              {piece.productUrl && (
                <a href={piece.productUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                  Store ↗
                </a>
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => addToStudio(piece)} className={btnPrimary}>
                <Spark className="h-4 w-4" /> Add to Studio
              </button>
              <button
                onClick={() => toggleTray(piece)}
                disabled={!inTray.has(piece.key) && tray.length >= MAX_TRAY}
                aria-pressed={inTray.has(piece.key)}
                className={btnSecondary}
              >
                {inTray.has(piece.key) ? "✓ In outfit" : "Add to outfit"}
              </button>
              <button
                onClick={() => {
                  setMyTryOns(removeShopTryOn(piece.key));
                  setPiece(null);
                }}
                aria-label={`Remove ${piece.name}`}
                className="ml-auto p-2 text-[#5d6874] hover:text-[#c23a2c]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {open && (
        <ProductDetail
          product={open}
          onClose={() => setOpen(null)}
          onTryLive={() => tryInStudio(trayItemFrom(open), "live")}
          inOutfit={inTray.has(open.id)}
          outfitFull={tray.length >= MAX_TRAY}
          onToggleOutfit={() => toggleTray(trayItemFrom(open))}
          saved={isSaved(open.id)}
          onToggleSaved={() => toggleSaved(open)}
        />
      )}
    </>
  );
}
