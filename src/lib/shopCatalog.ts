import type { LayeringRole } from "@/lib/layering";

/**
 * The Shopping catalog. Every field a real listing can have is here, so demo items can be swapped for properly
 * sourced products later (from a store's feed or partner programme) without changing the page.
 *
 * It's empty for now: no store has joined yet. Unknown fields are null and simply aren't shown.
 */

export type ShopColor = { name: string; hex: string };

export type ShopProduct = {
  id: string;
  /** A plain description of the piece (demo items) or the store's own product name (real listings). */
  name: string;
  /** The brand, when known. */
  brand: string | null;
  category: "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";
  layeringRole: LayeringRole;
  /** The main color word, used for search and to describe the piece to the try-on AI. */
  color: string;
  colors: ShopColor[];
  style: string;
  /** Descriptive words that are true of the piece as pictured (fit, fabric, details), used by search. */
  tags: string[];
  /** Our own image (in /public) or one we have permission to show. */
  imageUrl: string;
  /** The same picture with its background removed, for the shelf (null when there isn't one). */
  shelfImageUrl: string | null;
  price: number | null;
  currency: string | null;
  retailer: string | null;
  /** The store's product page, when there is one. */
  productUrl: string | null;
  availability: string | null;
  /** When the listing was last checked (ISO date), when known. */
  updatedAt: string | null;
  /** Whether the picture works for try-on (a clear photo of one garment). */
  tryOnEligible: boolean;
  /** Demonstration data, not a real store listing. */
  isDemo: boolean;
};

/** How demo items are labelled wherever a brand would show. */
export const DEMO_LABEL = "Virm demo";

/**
 * Real, properly sourced listings go here (from a store's own feed, with permission). Virm's own demo pieces were
 * taken out: Shopping shows the person's own added pieces, and (for admins) a preview of real store shelves.
 */
export const SHOP_PRODUCTS: ShopProduct[] = [];

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

/** Filter choices, taken from the catalog itself (a filter with nothing to choose isn't shown). */
export const SHOP_COLORS = unique(SHOP_PRODUCTS.flatMap((p) => p.colors.map((c) => c.name)));
export const SHOP_STYLES = unique(SHOP_PRODUCTS.map((p) => p.style));
export const SHOP_BRANDS = unique(SHOP_PRODUCTS.map((p) => p.brand));
export const HAS_PRICES = SHOP_PRODUCTS.some((p) => p.price !== null);

export const PRICE_BANDS = [
  { value: "under-50", label: "Under $50", test: (p: number) => p < 50 },
  { value: "50-150", label: "$50–$150", test: (p: number) => p >= 50 && p <= 150 },
  { value: "over-150", label: "$150+", test: (p: number) => p > 150 },
] as const;

/**
 * Real listings show their price and store link only once checked (updatedAt set when the listing was verified).
 * Demo pieces never show either.
 */
export const isVerified = (p: ShopProduct) => !p.isDemo && Boolean(p.updatedAt);


/** Every word of the search must appear somewhere in the piece's details (plurals match too: "shirts" finds "shirt"). */
export function matchesSearch(p: ShopProduct, query: string): boolean {
  const words = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.endsWith("s") ? w.slice(0, -1) : w));
  if (!words.length) return true;
  const haystack = [p.name, p.brand, p.retailer, p.color, p.category, p.style, ...p.tags, ...p.colors.map((c) => c.name)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

// Searches worth suggesting. Only the ones that find something in the current catalog are shown, so a suggestion
// never leads nowhere (and none is forced to match).
const SEARCH_IDEAS = [
  "Linen shirts",
  "Straight-leg jeans",
  "Minimalist jackets",
  "Everyday sneakers",
  "Summer sandals",
  "Tailored trousers",
  "Knit sweaters",
  "Leather boots",
  "Denim shorts",
];
export const SUGGESTED_SEARCHES = SEARCH_IDEAS.filter((idea) => SHOP_PRODUCTS.some((p) => matchesSearch(p, idea)));

/** A price in its own currency, or null when it isn't known. */
export function priceLabel(price: number | null, currency: string | null): string | null {
  if (price === null) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD" }).format(price);
  } catch {
    return `${price}${currency ? ` ${currency}` : ""}`;
  }
}

/** Shopping's "Your outfit" list, kept on this device (Studio's Shop panel shows it first too). */
export const SHOP_OUTFIT_KEY = "virm-shop-outfit";

/** Shop picks handed to the Live page (kept for this browser tab). */
export const LIVE_SHOP_KEY = "virm-live-shop";

/**
 * A piece in the try-on tray: from the sample collection, or found in another store (pasted link or uploaded
 * photo). Store finds keep their page link so "View in store" can open it; nothing is bought through Virm.
 */
/** What a tray piece is: a collection kind, or a whole outfit from one store picture. */
export type TrayCategory = ShopProduct["category"] | "outfit";

export type TrayItem = {
  key: string;
  name: string;
  /** The brand (sample collection) or the store it came from. */
  label: string;
  category: TrayCategory;
  layeringRole: LayeringRole;
  color: string;
  imageUrl: string;
  price: string | null;
  productUrl: string | null;
};

export const trayItemFrom = (p: ShopProduct): TrayItem => ({
  key: p.id,
  name: p.name,
  label: p.brand ?? (p.isDemo ? DEMO_LABEL : (p.retailer ?? "")),
  category: p.category,
  layeringRole: p.layeringRole,
  color: p.color,
  imageUrl: p.imageUrl,
  price: priceLabel(p.price, p.currency),
  productUrl: p.productUrl,
});

/**
 * A Shopping piece in the shape the Studio's look uses (like a closet item, but its id starts with "shop-", so it's
 * never mistaken for something owned). Store finds keep their page link and store name.
 */
export type ShopPiece = {
  id: string;
  imageUrl: string;
  category: string;
  description: string;
  layeringRole: LayeringRole;
  color: string;
  productUrl: string | null;
  retailer: string;
};

export const shopPiece = (t: TrayItem): ShopPiece => ({
  id: `shop-${t.key}`,
  imageUrl: t.imageUrl,
  category: t.category,
  description: t.name,
  layeringRole: t.layeringRole,
  color: t.color,
  productUrl: t.productUrl,
  retailer: t.label,
});

/** What each kind of piece is, for the layering rules. */
export const ROLE_FOR: Record<TrayCategory, LayeringRole> = {
  top: "mid_layer",
  bottom: "bottom",
  dress: "one_piece",
  outerwear: "outer_layer",
  shoes: "shoes",
  accessory: "accessory",
  outfit: "one_piece",
};
