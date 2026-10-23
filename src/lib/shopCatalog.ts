import type { LayeringRole } from "@/lib/layering";

/**
 * The sample shop: a fixed set of pieces to show the Shopping page and try on live. Names, brands and prices are
 * samples for the concept, not real products or partners. Photos are Virm's own clean product shots (plain
 * backgrounds, which the try-on reads best).
 */

export type ShopColor = { name: string; hex: string };

export type ShopProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";
  layeringRole: LayeringRole;
  /** The main color word, used for filtering and to describe the piece to the try-on AI. */
  color: string;
  colors: ShopColor[];
  sizes: string[];
  imageUrl: string;
};

export const SHOP_BRANDS = ["Virm Edit · Sample", "Independent Sample"] as const;
const EDIT = SHOP_BRANDS[0];
const INDIE = SHOP_BRANDS[1];

const LETTERS = ["XS", "S", "M", "L"];
const WAIST = ["24", "26", "28", "30", "32"];
const SHOE = ["36", "37", "38", "39", "40", "41"];

const WHITE = { name: "White", hex: "#f4f2ec" };
const BLACK = { name: "Black", hex: "#1c1d20" };
const SAND = { name: "Sand", hex: "#d8c7ab" };
const IVORY = { name: "Ivory", hex: "#efe6d4" };
const BLUE = { name: "Blue", hex: "#8fa9c7" };
const BROWN = { name: "Brown", hex: "#8a5f3c" };
const GREY = { name: "Grey", hex: "#a5a8ab" };

export const SHOP_PRODUCTS: ShopProduct[] = [
  { id: "airline-linen-shirt", name: "Airline Linen Shirt", brand: EDIT, price: 118, category: "top", layeringRole: "mid_layer", color: "light blue", colors: [BLUE, WHITE], sizes: LETTERS, imageUrl: "/sample/linen-shirt.jpg" },
  { id: "soft-structure-coat", name: "Soft Structure Coat", brand: EDIT, price: 248, category: "outerwear", layeringRole: "outer_layer", color: "camel", colors: [SAND, BROWN], sizes: LETTERS, imageUrl: "/sample/camel-coat.jpg" },
  { id: "relaxed-pale-jean", name: "Relaxed Pale Jean", brand: INDIE, price: 146, category: "bottom", layeringRole: "bottom", color: "light blue denim", colors: [BLUE], sizes: WAIST, imageUrl: "/sample/light-jeans.jpg" },
  { id: "garden-slip-dress", name: "Garden Slip Dress", brand: EDIT, price: 198, category: "dress", layeringRole: "one_piece", color: "cream floral", colors: [IVORY], sizes: LETTERS, imageUrl: "/sample/floral-sundress.jpg" },
  { id: "low-form-sneaker", name: "Low Form Sneaker", brand: INDIE, price: 132, category: "shoes", layeringRole: "shoes", color: "white", colors: [WHITE, BLACK], sizes: SHOE, imageUrl: "/sample/white-sneakers.jpg" },
  { id: "arc-chelsea-boot", name: "Arc Chelsea Boot", brand: EDIT, price: 220, category: "shoes", layeringRole: "shoes", color: "brown leather", colors: [BROWN, BLACK], sizes: SHOE, imageUrl: "/sample/chelsea-boots.jpg" },
  { id: "rib-turtleneck", name: "Rib Turtleneck", brand: INDIE, price: 94, category: "top", layeringRole: "mid_layer", color: "black", colors: [BLACK, IVORY], sizes: LETTERS, imageUrl: "/sample/turtleneck.jpg" },
  { id: "quilted-city-puffer", name: "Quilted City Puffer", brand: INDIE, price: 184, category: "outerwear", layeringRole: "outer_layer", color: "black", colors: [BLACK], sizes: ["S", "M", "L", "XL"], imageUrl: "/sample/puffer-jacket.jpg" },
  { id: "pleated-check-skirt", name: "Pleated Check Skirt", brand: EDIT, price: 128, category: "bottom", layeringRole: "bottom", color: "grey plaid", colors: [GREY], sizes: LETTERS, imageUrl: "/sample/plaid-skirt.jpg" },
  { id: "cable-crew-sweater", name: "Cable Crew Sweater", brand: EDIT, price: 156, category: "top", layeringRole: "mid_layer", color: "cream", colors: [IVORY, SAND], sizes: LETTERS, imageUrl: "/sample/cable-sweater.jpg" },
  { id: "wrap-belted-coat", name: "Wrap Belted Coat", brand: INDIE, price: 276, category: "outerwear", layeringRole: "outer_layer", color: "beige", colors: [SAND], sizes: LETTERS, imageUrl: "/sample/wrap-coat.jpg" },
  { id: "riviera-straw-hat", name: "Riviera Straw Hat", brand: EDIT, price: 68, category: "accessory", layeringRole: "accessory", color: "natural straw", colors: [SAND], sizes: ["One size"], imageUrl: "/sample/straw-hat.jpg" },
];

export const SHOP_COLORS = ["White", "Black", "Sand", "Ivory", "Blue", "Brown", "Grey"] as const;

export const PRICE_BANDS = [
  { value: "under-150", label: "Under $150", test: (p: number) => p < 150 },
  { value: "150-200", label: "$150–$200", test: (p: number) => p >= 150 && p <= 200 },
  { value: "over-200", label: "$200+", test: (p: number) => p > 200 },
] as const;

/** Shop picks handed to the Live page (kept for this browser tab). */
export const LIVE_SHOP_KEY = "virm-live-shop";
