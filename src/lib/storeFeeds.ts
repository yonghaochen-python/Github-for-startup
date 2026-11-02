import { env } from "cloudflare:workers";
import type { LayeringRole } from "@/lib/layering";
import type { ShopProduct } from "@/lib/shopCatalog";

/**
 * PREVIEW (admin only): real products read from a few stores' public Shopify product lists, to see how sponsored
 * store shelves would look. These stores haven't agreed to appear in Virm, so nothing here is shown to the public;
 * when brands sign up they'd supply their own feed instead. Pictures are shown from the store's own image server,
 * never copied. Each list is read at most once a day and kept in private storage.
 */

export type StoreShelf = { id: string; name: string; domain: string; products: ShopProduct[] };

const STORES = [
  { id: "allbirds", name: "Allbirds", domain: "www.allbirds.com" },
  { id: "alo", name: "Alo Yoga", domain: "www.aloyoga.com" },
  { id: "taylor-stitch", name: "Taylor Stitch", domain: "www.taylorstitch.com" },
  { id: "tentree", name: "Tentree", domain: "www.tentree.com" },
  { id: "cuyana", name: "Cuyana", domain: "www.cuyana.com" },
] as const;

const PER_STORE = 16;
const DAY_MS = 24 * 60 * 60 * 1000;
const cacheKey = (id: string) => `private/store-feeds/${id}.json`;

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  tags: string[] | string;
  updated_at: string;
  images: { src: string }[];
  variants: { price: string; available?: boolean }[];
};

/** Things that aren't clothing, or can't be tried on from one picture. */
const SKIP = /gift ?card|sock|underwear|boxer|brief|insole|lace kit|laces|care kit|cleaner|charm|keychain|key ring|mask|bottle|candle|mat\b|towel|e-gift|cuff\b|bracelet|necklace|earring|\bring\b|jewel/i;

const KINDS: [RegExp, ShopProduct["category"], LayeringRole][] = [
  [/sneaker|runner|shoe|boot|sandal|slide|flip ?flop|loafer|slipper|clog|mule|trainer|dasher|lounger/i, "shoes", "shoes"],
  [/dress|jumpsuit|romper|onesie/i, "dress", "one_piece"],
  [/jacket|coat|parka|puffer|anorak|blazer|shacket|vest|windbreaker|overshirt/i, "outerwear", "outer_layer"],
  // "shorts", not "short sleeve".
  [/pant|jean|\bshorts\b|skirt|legging|trouser|jogger|chino|sweatpant|skort/i, "bottom", "bottom"],
  [/hoodie|sweater|sweatshirt|cardigan|pullover|fleece|crew ?neck|quarter.?zip|half.?zip/i, "top", "mid_layer"],
  [/shirt|tee|t-shirt|top|tank|polo|blouse|henley|flannel|bra|bodysuit|camisole|long sleeve/i, "top", "base_layer"],
  [/bag|tote|backpack|purse|clutch|wallet|hat|cap|beanie|belt|scarf|crossbody|pouch|sunglass/i, "accessory", "accessory"],
];

function kindOf(p: ShopifyProduct): [ShopProduct["category"], LayeringRole] | null {
  const text = `${p.product_type} ${p.title}`;
  if (SKIP.test(text)) return null;
  const match = KINDS.find(([re]) => re.test(text));
  return match ? [match[1], match[2]] : null;
}

const DESCRIBING =
  /cotton|linen|wool|merino|cashmere|leather|suede|denim|flannel|fleece|knit|rib|sleeve|crew|v-neck|hood|zip|quilt|waterproof|relaxed|slim|oversized|cropped|rise|wide leg|straight|stretch|recycled|canvas|terry|nylon|silk|plaid|stripe|organic|lightweight|insulated/;

/** A smaller copy from the store's image server (Shopify resizes on request). */
const sized = (src: string, width: number) => `${src}${src.includes("?") ? "&" : "?"}width=${width}`;

function toProduct(store: (typeof STORES)[number], p: ShopifyProduct): ShopProduct | null {
  const kind = kindOf(p);
  const image = p.images?.[0]?.src;
  const price = Number(p.variants?.[0]?.price);
  if (!kind || !image || !Number.isFinite(price)) return null;
  const rawTags = (Array.isArray(p.tags) ? p.tags : p.tags.split(",")).map((t) => t.trim());
  // Stores tag products for their own systems ("b2b", "CYBERSALE", "chino-variant-oos"); keep plain describing words.
  // Only plain words that describe the piece (fabric, fit, sleeves...), so search and details stay meaningful.
  const tags = rawTags.map((t) => t.toLowerCase()).filter((t) => /^[a-z][a-z -]{2,24}$/.test(t) && DESCRIBING.test(t));
  // "Color:Red" / "color => red" style tags give the color when there is one.
  const color = rawTags.map((t) => /^colou?r\s*(?::|=>)\s*([^:]+)/i.exec(t)?.[1]?.trim()).find(Boolean)?.toLowerCase() ?? "";
  return {
    id: `store-${store.id}-${p.id}`,
    name: p.title,
    brand: store.name,
    category: kind[0],
    layeringRole: kind[1],
    color,
    colors: [],
    style: "",
    tags: [...new Set(tags)].slice(0, 8),
    imageUrl: sized(image, 900),
    shelfImageUrl: null,
    price,
    // The public list gives no currency; these stores' US sites price in dollars.
    currency: "USD",
    retailer: store.name,
    productUrl: `https://${store.domain}/products/${p.handle}`,
    availability: p.variants.some((v) => v.available !== false) ? "in stock" : "sold out",
    updatedAt: p.updated_at,
    tryOnEligible: kind[0] !== "accessory",
    isDemo: false,
  };
}

async function readStore(store: (typeof STORES)[number]): Promise<ShopProduct[]> {
  const res = await fetch(`https://${store.domain}/products.json?limit=60`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Virm store preview)", accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${store.name}: ${res.status}`);
  const data = (await res.json()) as { products?: ShopifyProduct[] };
  const products = (data.products ?? []).flatMap((p) => toProduct(store, p) ?? []);
  // A mix of kinds rather than sixteen of the same shoe in different colors: one per style name first.
  const seen = new Set<string>();
  const firstOfEach = products.filter((p) => {
    // "The Jack in Merlot Plaid", "Canvas Runner - Deep Navy": the style name, without the color.
    const base = p.name.split(/\s+in\s+|\s+[-–|]\s+/)[0].trim().toLowerCase();
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
  return (firstOfEach.length >= 6 ? firstOfEach : products).slice(0, PER_STORE);
}

/**
 * Every store's shelf: from the day's saved copy, refreshed when older than a day or when asked (an old copy beats
 * none).
 */
export async function storeShelves(refresh = false): Promise<StoreShelf[]> {
  const shelves = await Promise.all(
    STORES.map(async (store) => {
      const saved = await env.UPLOADS.get(cacheKey(store.id)).catch(() => null);
      const cached = saved ? ((await saved.json()) as { at: number; products: ShopProduct[] }) : null;
      if (cached && !refresh && Date.now() - cached.at < DAY_MS) return { ...store, products: cached.products };
      try {
        const products = await readStore(store);
        await env.UPLOADS.put(cacheKey(store.id), JSON.stringify({ at: Date.now(), products }), {
          httpMetadata: { contentType: "application/json" },
        });
        return { ...store, products };
      } catch (err) {
        console.error("Store preview couldn't be read:", err instanceof Error ? err.message : "unknown");
        return { ...store, products: cached?.products ?? [] };
      }
    })
  );
  return shelves.filter((s) => s.products.length > 0);
}
