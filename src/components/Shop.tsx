"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  HAS_PRICES,
  LIVE_SHOP_KEY,
  PRICE_BANDS,
  SHOP_BRANDS,
  SHOP_OUTFIT_KEY,
  SHOP_COLORS,
  SHOP_PRODUCTS,
  SHOP_STYLES,
  SUGGESTED_SEARCHES,
  isVerified,
  matchesSearch,
  priceLabel,
  shopPiece,
  trayItemFrom,
  type ShopProduct,
  type TrayItem,
} from "@/lib/shopCatalog";
import { addToWishlist, readWishlist, removeFromWishlist } from "@/lib/shopWishlist";
import { StoreFinder } from "@/components/StoreFinder";
import { ProductDetail } from "@/components/ProductDetail";

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

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const label = "text-[10.5px] font-medium uppercase tracking-[2px] text-[#5d6874]";
const underlineSelect =
  "w-full appearance-none border-b border-black/15 bg-transparent py-1.5 pr-6 text-[13px] text-[#121821] outline-none focus:border-[#121821]";

export function Shop() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("all");
  const [style, setStyle] = useState("all");
  const [price, setPrice] = useState("all");
  const [brand, setBrand] = useState("all");
  const [tab, setTab] = useState("all");
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [wishlist, setWishlist] = useState<TrayItem[]>([]);
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const [importing, setImporting] = useState(false);
  // Swap: the outfit piece being replaced; the next piece picked takes its place.
  const [swapping, setSwapping] = useState<TrayItem | null>(null);
  // Phones: the outfit sits in a slim bar at the bottom; this opens its list.
  const [outfitOpen, setOutfitOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The wishlist and "Your outfit" are remembered on this device only.
  useEffect(() => {
    try {
      localStorage.removeItem(OLD_LOVED_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
    setWishlist(readWishlist());
    try {
      const outfit = JSON.parse(localStorage.getItem(OUTFIT_KEY) ?? "[]");
      if (Array.isArray(outfit)) {
        setTray(outfit.filter((x) => x && typeof x.key === "string" && typeof x.imageUrl === "string").slice(0, MAX_TRAY));
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

  /** Adds a piece to the tray, or takes it out (up to MAX_TRAY pieces). */
  function toggleTray(item: TrayItem) {
    const replacing = swapping && swapping.key !== item.key ? swapping : null;
    if (swapping) setSwapping(null);
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

  const shown = useMemo(() => {
    const band = PRICE_BANDS.find((b) => b.value === price);
    return SHOP_PRODUCTS.filter(
      (p) =>
        (tab === "all" || p.category === tab) &&
        (color === "all" || p.colors.some((c) => c.name === color)) &&
        (style === "all" || p.style === style) &&
        (!band || (p.price !== null && band.test(p.price))) &&
        (brand === "all" || p.brand === brand) &&
        matchesSearch(p, query)
    );
  }, [query, color, style, price, brand, tab]);

  // Only filters that have something to choose from (demo items have no brand or price).
  const filters = [
    ["Color", color, setColor, SHOP_COLORS.map((c) => [c, c])],
    ["Style", style, setStyle, SHOP_STYLES.map((c) => [c, c])],
    ...(SHOP_BRANDS.length ? [["Brand", brand, setBrand, SHOP_BRANDS.map((b) => [b, b])]] : []),
    ...(HAS_PRICES ? [["Price", price, setPrice, PRICE_BANDS.map((b) => [b.value, b.label])]] : []),
  ] as [string, string, (v: string) => void, string[][]][];
  const activeFilters = [color, style, price, brand].filter((v) => v !== "all").length;
  const allDemo = shown.length > 0 && shown.every((p) => p.isDemo);

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
              {tray.length} selected{tray.length >= MAX_TRAY ? " (the most)" : ""} · shopping pieces, not your closet
            </p>
          </div>
          {tray.length > 0 && (
            <button
              onClick={() => {
                setTray([]);
                keepOutfit([]);
                setSwapping(null);
              }}
              className="text-[11px] text-[#5d6874] underline-offset-4 hover:text-[#121821] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {tray.length === 0 ? (
          <p className="mt-4 border-t border-black/[0.07] pt-4 text-[12px] leading-snug text-[#5d6874]">
            Tap <b className="font-semibold text-[#121821]">+</b> on pieces to build a look, then try it on in Studio.
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
        <p className="mt-2 text-center text-[10.5px] text-[#5d6874]">Choose Photo or Live there. Two of a kind? Compare them in Studio.</p>
      </>
    );
  }

  return (
    <>
      <section id="collection" className={`mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-8 sm:px-6 ${tray.length ? "pb-32 lg:pb-16" : "pb-16"}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[44px] leading-none tracking-[-1px] text-[#121821] sm:text-[52px]">Shopping</h1>
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
          {/* Secondary to search: bring in a piece from any store. */}
          <button
            onClick={() => setImporting((v) => !v)}
            aria-expanded={importing}
            className="shrink-0 text-[12px] font-semibold text-[#4f5b66] underline-offset-4 hover:text-[#121821] hover:underline"
          >
            {importing ? "Close" : "+ Add a product"}
          </button>
          </div>
          {!query && searchFocused && (
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
            <StoreFinder onTryNow={(item) => tryInStudio(item)} onAdd={toggleTray} onSave={saveFind} trayFull={tray.length >= MAX_TRAY} />
          </div>
        )}

        <div className="mt-5 flex items-center gap-4 border-b border-black/10">
        <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className={`shrink-0 pb-1 text-[12.5px] ${tab === t.value ? "border-b border-[#121821] font-semibold text-[#121821]" : "text-[#5d6874] hover:text-[#121821]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-label={activeFilters ? `Filters (${activeFilters} on)` : "Filters"}
            title="Filters"
            className={`relative mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${filtersOpen ? "bg-[#121821] text-white" : "text-[#26313a] hover:bg-black/5"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            {activeFilters > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#c23a2c]" />}
          </button>
        </div>
        {filtersOpen && (
          <div className="mt-4 grid max-w-[480px] gap-4" style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }}>
            {filters.map(([name, value, set, options]) => (
              <label key={name} className="relative block">
                <span className={`${label} text-[9.5px]`}>{name}</span>
                <select value={value} onChange={(e) => set(e.target.value)} className={underlineSelect}>
                  <option value="all">All</option>
                  {options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <span aria-hidden className="pointer-events-none absolute bottom-2 right-1 text-[10px] text-[#5d6874]">
                  ▾
                </span>
              </label>
            ))}
          </div>
        )}

        <div id="collection-grid" className="mt-6 grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {swapping && (
              <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-[#121821] px-4 py-3 text-[12.5px] text-white">
                <span className="flex-1">
                  Pick a replacement for <b>{swapping.name}</b>.
                </span>
                <button onClick={() => setSwapping(null)} className="font-semibold underline underline-offset-4">
                  Cancel
                </button>
              </div>
            )}
            <p className="mb-4 text-[11.5px] text-[#5d6874]">
              {shown.length} {allDemo ? "demo " : ""}
              {shown.length === 1 ? "piece" : "pieces"}
              {allDemo && " · not store listings"}
            </p>
            {shown.length === 0 ? (
              <div className="rounded-[6px] bg-white px-6 py-10 text-center text-[13px] text-[#5d6874]">
                {query.trim() ? (
                  <>
                    <p className="text-[14px] text-[#121821]">No pieces match &ldquo;{query.trim()}&rdquo;.</p>
                    <p className="mt-1">Try one of these:</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {SUGGESTED_SEARCHES.map((s) => (
                        <button key={s} onClick={() => setQuery(s)} className="rounded-full px-3 py-1.5 text-[12px] text-[#26313a] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]">
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-[12px]">
                      Saw it somewhere else?{" "}
                      <button onClick={() => setImporting(true)} className="font-semibold text-[#121821] underline underline-offset-4">
                        Add a product
                      </button>{" "}
                      from any store.
                    </p>
                  </>
                ) : (
                  <>
                    <p>Nothing matches these filters.</p>
                    <button
                      onClick={() => {
                        setTab("all");
                        setColor("all");
                        setStyle("all");
                        setPrice("all");
                        setBrand("all");
                      }}
                      className="mt-3 font-semibold text-[#121821] underline underline-offset-4"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                {shown.map((p) => {
                  const selected = inTray.has(p.id);
                  const saved = isSaved(p.id);
                  // Price and store link only for verified real listings.
                  const price = isVerified(p) ? priceLabel(p.price, p.currency) : null;
                  return (
                    <li key={p.id} className="flex flex-col">
                      <div className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
                        <button onClick={() => setOpen(p)} aria-label={`Open ${p.name}`} className="absolute inset-0">
                          <Image src={p.imageUrl} alt={p.name} fill unoptimized className="p-5 transition duration-500 hover:scale-[1.03]" style={{ objectFit: "contain" }} />
                        </button>
                        <button
                          onClick={() => toggleSaved(p)}
                          aria-pressed={saved}
                          aria-label={saved ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
                          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm ${saved ? "text-[#c23a2c]" : "text-[#29343a]"}`}
                        >
                          <Heart filled={saved} />
                        </button>
                        {p.isDemo && (
                          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#4f5b66]">
                            Demo
                          </span>
                        )}
                        {selected && (
                          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-[#121821]/85 px-2.5 py-1.5 text-[9.5px] font-medium uppercase tracking-[1.5px] text-white">
                            ✓ In outfit
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <button onClick={() => setOpen(p)} className="min-w-0 text-left">
                          {!p.isDemo && <p className="text-[9.5px] uppercase tracking-[1.6px] text-[#5d6874]">{p.brand ?? p.retailer}</p>}
                          <p className="mt-0.5 truncate text-[13.5px] font-medium text-[#121821] hover:underline">{p.name}</p>
                        </button>
                        {price && <p className="text-[13px] font-medium text-[#121821]">{price}</p>}
                      </div>
                      {isVerified(p) && p.productUrl && (
                        <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className="mt-1 self-start text-[11px] text-[#121821] underline underline-offset-2">
                          Store ↗
                        </a>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setOpen(p)}
                          className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#121821] text-[12px] font-medium text-white hover:bg-[#2a3542]"
                        >
                          <Spark className="hidden h-3.5 w-3.5 sm:block" /> Try on
                        </button>
                        <button
                          onClick={() => toggleTray(trayItemFrom(p))}
                          aria-pressed={selected}
                          aria-label={selected ? `Take ${p.name} out of your outfit` : `Add ${p.name} to your outfit`}
                          title={selected ? "In your outfit" : "Add to outfit"}
                          disabled={!p.tryOnEligible || (!selected && !swapping && tray.length >= MAX_TRAY)}
                          className={`inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[2px] border ${swapping && !selected ? "px-3" : "w-[42px]"} text-[12px] font-medium transition ${
                            selected ? "border-[#121821] bg-[#eef1f2] text-[#121821]" : "border-black/15 bg-white text-[#121821] hover:border-[#121821] disabled:opacity-40"
                          }`}
                        >
                          {selected ? "✓" : swapping ? "Swap in" : <span className="text-[18px] font-light leading-none">+</span>}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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
