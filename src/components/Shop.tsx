"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClothingItem } from "@/components/OutfitCard";
import {
  LIVE_SHOP_KEY,
  PRICE_BANDS,
  SHOP_BRANDS,
  SHOP_COLORS,
  SHOP_PRODUCTS,
  trayItemFrom,
  type TrayItem,
} from "@/lib/shopCatalog";
import { addToWishlist, readWishlist, removeFromWishlist } from "@/lib/shopWishlist";
import { StoreFinder } from "@/components/StoreFinder";

/**
 * Shopping: a sample collection to browse and try on. Pieces picked with "Try on virtually" go into the live
 * try-on tray (up to six, several of a kind allowed, e.g. two jackets to compare); "Try on selected items" opens
 * Live wearing one of each and the rest a tap away. Prices, brands and products are samples; nothing is sold and
 * nothing is added to the closet.
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

const LOVED_KEY = "virm-shop-loved";
// "Your outfit" is kept on this device too, so it's still there after visiting Live (or leaving Shopping).
const OUTFIT_KEY = "virm-shop-outfit";

function keepOutfit(list: TrayItem[]) {
  try {
    localStorage.setItem(OUTFIT_KEY, JSON.stringify(list));
  } catch {}
}
const MAX_TRAY = 6;

/** A tray piece in the shape the outfit rules and the Live page use (store finds keep their page link). */
export type LivePick = ClothingItem & { color: string; productUrl: string | null; retailer: string };
const asPiece = (t: TrayItem): LivePick => ({
  id: `shop-${t.key}`,
  imageUrl: t.imageUrl,
  category: t.category,
  description: t.name,
  layeringRole: t.layeringRole,
  color: t.color,
  productUrl: t.productUrl,
  retailer: t.label,
});

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
  const [price, setPrice] = useState("all");
  const [brand, setBrand] = useState("all");
  const [tab, setTab] = useState("all");
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [loved, setLoved] = useState<string[]>([]);
  const [wishlist, setWishlist] = useState<TrayItem[]>([]);

  // Hearts are remembered on this device only.
  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(LOVED_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
      if (Array.isArray(kept)) setLoved(kept.filter((x) => typeof x === "string"));
    } catch {}
    setWishlist(readWishlist());
    try {
      const outfit = JSON.parse(localStorage.getItem(OUTFIT_KEY) ?? "[]");
      if (Array.isArray(outfit)) {
        setTray(outfit.filter((x) => x && typeof x.key === "string" && typeof x.imageUrl === "string").slice(0, MAX_TRAY));
      }
    } catch {}
  }, []);

  function toggleLoved(id: string) {
    setLoved((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      try {
        localStorage.setItem(LOVED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  /** Adds a piece to the tray, or takes it out (up to MAX_TRAY pieces). */
  function toggleTray(item: TrayItem) {
    setTray((list) => {
      const next = list.some((p) => p.key === item.key) ? list.filter((p) => p.key !== item.key) : list.length >= MAX_TRAY ? list : [...list, item];
      keepOutfit(next);
      return next;
    });
  }

  /** Opens Live with the tray (plus one more piece, when trying a store find straight away). */
  function tryOnLive(extra?: TrayItem) {
    const pieces = extra && !tray.some((p) => p.key === extra.key) ? [...tray, extra].slice(-MAX_TRAY) : tray;
    if (!pieces.length) return;
    try {
      sessionStorage.setItem(LIVE_SHOP_KEY, JSON.stringify(pieces.map(asPiece)));
    } catch {}
    router.push("/live");
  }

  /** Saves a store find to this device's wishlist (with a smaller picture so a dozen fit). */
  function saveFind(item: TrayItem): boolean {
    const ok = addToWishlist(item);
    setWishlist(readWishlist());
    return ok;
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const band = PRICE_BANDS.find((b) => b.value === price);
    return SHOP_PRODUCTS.filter(
      (p) =>
        (tab === "all" || p.category === tab) &&
        (color === "all" || p.colors.some((c) => c.name === color)) &&
        (!band || band.test(p.price)) &&
        (brand === "all" || p.brand === brand) &&
        (!q || [p.name, p.brand, p.color, p.category].some((v) => v.toLowerCase().includes(q)))
    );
  }, [query, color, price, brand, tab]);

  const inTray = new Set(tray.map((p) => p.key));

  return (
    <>
      <section id="collection" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[44px] leading-none tracking-[-1px] text-[#121821] sm:text-[52px]">Shopping</h1>
          <Link href="/live" className="flex items-baseline gap-3 text-[10.5px] uppercase tracking-[1.6px] text-[#5d6874] hover:text-[#121821]">
            <span className="font-display text-[18px] normal-case italic tracking-normal text-[#29343a]">20 sec</span>
            Live session preview
          </Link>
        </div>

        <div className="mt-6">
          <StoreFinder onTryNow={(item) => tryOnLive(item)} onAdd={toggleTray} onSave={saveFind} trayFull={tray.length >= MAX_TRAY} />
        </div>

        {wishlist.length > 0 && (
          <div className="mt-6">
            <p className={label}>Your wishlist</p>
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {wishlist.map((w) => {
                const added = tray.some((p) => p.key === w.key);
                return (
                  <li key={w.key} className="w-[150px] shrink-0 rounded-[6px] bg-white p-2.5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_8px_22px_rgba(18,30,45,0.05)]">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a picture saved on this device */}
                      <img src={w.imageUrl} alt={w.name} className="absolute inset-0 h-full w-full object-contain p-1.5" />
                    </div>
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

        <div className="mt-8 grid gap-6 border-b border-black/10 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-end">
          <label className="flex max-w-md items-center gap-3 border-b border-black/15 pb-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#5d6874]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clothes, brands, or styles…"
              aria-label="Search the collection"
              className="w-full bg-transparent text-[13px] text-[#121821] outline-none placeholder:text-[#7d8790]"
            />
          </label>
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["Color", color, setColor, SHOP_COLORS.map((c) => [c, c])],
                ["Price", price, setPrice, PRICE_BANDS.map((b) => [b.value, b.label])],
                ["Brand", brand, setBrand, SHOP_BRANDS.map((b) => [b, b])],
              ] as [string, string, (v: string) => void, string[][]][]
            ).map(([name, value, set, options]) => (
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
        </div>

        <div className="flex gap-6 overflow-x-auto pt-4">
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="mb-3 flex justify-between text-[10px] uppercase tracking-[1.8px] text-[#5d6874]">
              <span>
                {shown.length} sample {shown.length === 1 ? "piece" : "pieces"}
              </span>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-[6px] bg-white px-6 py-10 text-center text-[13px] text-[#5d6874]">Nothing matches. Try another filter.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                {shown.map((p) => {
                  const selected = inTray.has(p.id);
                  const isLoved = loved.includes(p.id);
                  return (
                    <li key={p.id} className="flex flex-col">
                      <div className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
                        <Image src={p.imageUrl} alt={p.name} fill unoptimized className="p-5 transition duration-500 hover:scale-[1.03]" style={{ objectFit: "contain" }} />
                        <button
                          onClick={() => toggleLoved(p.id)}
                          aria-pressed={isLoved}
                          aria-label={isLoved ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
                          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm ${isLoved ? "text-[#c23a2c]" : "text-[#29343a]"}`}
                        >
                          <Heart filled={isLoved} />
                        </button>
                        {selected && (
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-[#121821]/85 px-2.5 py-1.5 text-[9.5px] font-medium uppercase tracking-[1.5px] text-white">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9.5px] uppercase tracking-[1.6px] text-[#5d6874]">{p.brand}</p>
                          <p className="mt-0.5 truncate text-[13.5px] font-medium text-[#121821]">{p.name}</p>
                        </div>
                        <p className="text-[13px] font-medium text-[#121821]">${p.price}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="flex gap-1.5" aria-label={`Colors: ${p.colors.map((c) => c.name).join(", ")}`}>
                          {p.colors.map((c) => (
                            <span key={c.name} title={c.name} className="h-3 w-3 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />
                          ))}
                        </span>
                        <span className="truncate text-[10px] tracking-[0.5px] text-[#5d6874]">{p.sizes.join(" · ")}</span>
                      </div>
                      <button
                        onClick={() => toggleTray(trayItemFrom(p))}
                        aria-pressed={selected}
                        disabled={!selected && tray.length >= MAX_TRAY}
                        className={`mt-3 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[2px] border text-[12px] font-medium transition ${
                          selected ? "border-[#121821] bg-[#121821] text-white" : "border-black/15 bg-white text-[#121821] hover:border-[#121821] disabled:opacity-40"
                        }`}
                      >
                        {selected ? "✓ Selected for try-on" : (
                          <>
                            <Spark className="h-3.5 w-3.5" /> Try on virtually
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* The live try-on tray */}
          <aside aria-label="Your outfit" className="self-start rounded-[6px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:sticky lg:top-24">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#121821]">Your outfit</p>
                <p className="text-[11px] text-[#5d6874]">
                  {tray.length} selected{tray.length >= MAX_TRAY ? " (the most)" : ""}
                </p>
              </div>
              {tray.length > 0 && (
                <button onClick={() => {
                    setTray([]);
                    keepOutfit([]);
                  }} className="text-[11px] text-[#5d6874] underline-offset-4 hover:text-[#121821] hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="my-4 border-t border-black/[0.07]" />
            {tray.length === 0 ? (
              <div className="flex flex-col items-center px-2 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f5f6] text-[#29343a]">
                  <Spark />
                </span>
                <p className="mt-3 text-[13px] font-medium text-[#121821]">Build a look to try on</p>
                <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">Add pieces from any store or the collection, then try them on together.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {tray.map((p) => (
                  <li key={p.key} className="flex items-center gap-3">
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
                    <button onClick={() => toggleTray(p)} aria-label={`Remove ${p.name}`} className="p-1 text-[#5d6874] hover:text-[#c23a2c]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                        <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="my-4 border-t border-black/[0.07]" />
            <p className="mb-3 text-center text-[10.5px] text-[#5d6874]">Pick two of a kind to compare. On Live, switch between them during one session.</p>
            <button
              onClick={() => tryOnLive()}
              disabled={tray.length === 0}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[2px] bg-[#121821] text-[12.5px] font-medium text-white hover:bg-[#2a3542] disabled:bg-[#c9cdd0]"
            >
              <Spark className="h-3.5 w-3.5" /> Try on selected items
            </button>
          </aside>
        </div>
      </section>
    </>
  );
}
