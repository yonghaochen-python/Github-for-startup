import type { LayeringRole } from "@/lib/layering";

/**
 * The Shopping catalog. Every field a real listing can have is here, so demo items can be swapped for properly
 * sourced products later (from a store's feed or partner programme) without changing the page.
 *
 * For now it holds only demo items: Virm's own product photos, clearly labelled, with no brand, store, price or
 * sizes (none are invented). Unknown fields are null and simply aren't shown.
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
  /** Our own image (in /public) or one we have permission to show. */
  imageUrl: string;
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

const WHITE = { name: "White", hex: "#f4f2ec" };
const BLACK = { name: "Black", hex: "#1c1d20" };
const CAMEL = { name: "Camel", hex: "#c19a6b" };
const CREAM = { name: "Cream", hex: "#efe6d4" };
const BLUE = { name: "Blue", hex: "#8fa9c7" };
const BROWN = { name: "Brown", hex: "#8a5f3c" };
const GREY = { name: "Grey", hex: "#a5a8ab" };
const BEIGE = { name: "Beige", hex: "#d8c7ab" };

const demo = (p: Pick<ShopProduct, "id" | "name" | "category" | "layeringRole" | "color" | "colors" | "style" | "imageUrl">): ShopProduct => ({
  ...p,
  brand: null,
  price: null,
  currency: null,
  retailer: null,
  productUrl: null,
  availability: null,
  updatedAt: null,
  tryOnEligible: true,
  isDemo: true,
});

export const SHOP_PRODUCTS: ShopProduct[] = [
  demo({ id: "demo-linen-shirt", name: "Linen shirt", category: "top", layeringRole: "mid_layer", color: "light blue", colors: [BLUE], style: "Casual", imageUrl: "/sample/linen-shirt.jpg" }),
  demo({ id: "demo-camel-coat", name: "Camel coat", category: "outerwear", layeringRole: "outer_layer", color: "camel", colors: [CAMEL], style: "Classic", imageUrl: "/sample/camel-coat.jpg" }),
  demo({ id: "demo-light-jeans", name: "Light-wash jeans", category: "bottom", layeringRole: "bottom", color: "light blue denim", colors: [BLUE], style: "Casual", imageUrl: "/sample/light-jeans.jpg" }),
  demo({ id: "demo-floral-sundress", name: "Floral sundress", category: "dress", layeringRole: "one_piece", color: "cream floral", colors: [CREAM], style: "Summer", imageUrl: "/sample/floral-sundress.jpg" }),
  demo({ id: "demo-white-sneakers", name: "White sneakers", category: "shoes", layeringRole: "shoes", color: "white", colors: [WHITE], style: "Casual", imageUrl: "/sample/white-sneakers.jpg" }),
  demo({ id: "demo-chelsea-boots", name: "Chelsea boots", category: "shoes", layeringRole: "shoes", color: "brown leather", colors: [BROWN], style: "Classic", imageUrl: "/sample/chelsea-boots.jpg" }),
  demo({ id: "demo-turtleneck", name: "Rib turtleneck", category: "top", layeringRole: "mid_layer", color: "black", colors: [BLACK], style: "Classic", imageUrl: "/sample/turtleneck.jpg" }),
  demo({ id: "demo-puffer", name: "Quilted puffer jacket", category: "outerwear", layeringRole: "outer_layer", color: "black", colors: [BLACK], style: "Cozy", imageUrl: "/sample/puffer-jacket.jpg" }),
  demo({ id: "demo-plaid-skirt", name: "Pleated plaid skirt", category: "bottom", layeringRole: "bottom", color: "grey plaid", colors: [GREY], style: "Classic", imageUrl: "/sample/plaid-skirt.jpg" }),
  demo({ id: "demo-cable-sweater", name: "Cable-knit sweater", category: "top", layeringRole: "mid_layer", color: "cream", colors: [CREAM], style: "Cozy", imageUrl: "/sample/cable-sweater.jpg" }),
  demo({ id: "demo-wrap-coat", name: "Belted wrap coat", category: "outerwear", layeringRole: "outer_layer", color: "beige", colors: [BEIGE], style: "Classic", imageUrl: "/sample/wrap-coat.jpg" }),
  demo({ id: "demo-straw-hat", name: "Straw hat", category: "accessory", layeringRole: "accessory", color: "natural straw", colors: [BEIGE], style: "Summer", imageUrl: "/sample/straw-hat.jpg" }),
];

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
