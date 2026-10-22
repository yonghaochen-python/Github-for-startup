import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLASSIFY_MODEL, firstText } from "@/lib/anthropic";
import type { SavedImage } from "@/lib/images";
import {
  CATEGORIES,
  FORMALITIES,
  SEASONS,
  LAYERING_ROLES,
  WARMTH_LEVELS,
  cleanBrand,
  type ClothingAttributes,
} from "@/lib/clothingTaxonomy";

/**
 * Multi-item detection, split into the stages called out by the feature spec so a
 * real segmentation/object-detection API can slot in later without touching the
 * route or the client:
 *   1. Image upload         -> handled by the caller via lib/images.ts (unchanged)
 *   2. Image analysis       -> the Anthropic vision call below (or the placeholder)
 *   3. Item detection       -> DetectedItem[] with a name + boundingBox per item
 *   4. Item metadata        -> the rest of each DetectedItem (category/layeringRole/etc.)
 *   5. Closet storage       -> handled by the caller (api/closet/items/bulk), not here
 */

/** Fractions of the source image, (0,0) = top-left, (1,1) = bottom-right. */
export type BoundingBox = { x: number; y: number; width: number; height: number };

export type DetectedItem = ClothingAttributes & {
  name: string;
  boundingBox: BoundingBox;
};

/** A box in the pixel grid of the image Claude was shown (pixel coordinates are more accurate than fractions). */
type PixelBox = { left: number; top: number; right: number; bottom: number };

const PIXEL_BOX_SCHEMA = {
  type: "object",
  description: "Tight box around the item, in pixels of this image",
  properties: {
    left: { type: "number" },
    top: { type: "number" },
    right: { type: "number" },
    bottom: { type: "number" },
  },
  required: ["left", "top", "right", "bottom"],
  additionalProperties: false,
};

export type ImageSize = { width: number; height: number };

/** Pixel box -> fractions of the image, kept inside it. Null when the box is empty. */
function toFractions(box: PixelBox, size: ImageSize): BoundingBox | null {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max) / max;
  const x1 = clamp(Math.min(box.left, box.right), size.width);
  const x2 = clamp(Math.max(box.left, box.right), size.width);
  const y1 = clamp(Math.min(box.top, box.bottom), size.height);
  const y2 = clamp(Math.max(box.top, box.bottom), size.height);
  if (x2 - x1 < 0.01 || y2 - y1 < 0.01) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

const DETECT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 0,
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short shopper-style name, e.g. 'White T-shirt'" },
          category: { type: "string", enum: CATEGORIES },
          layeringRole: {
            type: "string",
            enum: LAYERING_ROLES,
            description:
              "Where this sits when layering an outfit. base_layer: t-shirts/tanks/undershirts. mid_layer: long sleeves, shirts, hoodies, sweaters, sweatshirts, cardigans. outer_layer: jackets, coats, blazers, trench coats. bottom: pants/jeans/skirts/shorts. one_piece: dresses/jumpsuits. shoes. accessory.",
          },
          warmth: { type: "string", enum: WARMTH_LEVELS, description: "How warm this item is to wear" },
          color: { type: "string", description: "Primary color(s), e.g. 'navy' or 'white and red'" },
          pattern: { type: "string", description: "e.g. 'solid', 'striped', 'plaid', 'floral'" },
          material: { type: "string", description: "Best guess, e.g. 'cotton', 'denim', 'leather'" },
          formality: { type: "string", enum: FORMALITIES },
          season: { type: "string", enum: SEASONS },
          description: { type: "string", description: "Short shopper-style description, under 10 words" },
          brand: {
            type: "string",
            description:
              "The brand, ONLY if a logo, label or printed brand name is clearly visible on the item; otherwise an empty string. Never guess from style alone.",
          },
          box: PIXEL_BOX_SCHEMA,
        },
        required: [
          "name",
          "category",
          "layeringRole",
          "warmth",
          "color",
          "pattern",
          "material",
          "formality",
          "season",
          "description",
          "brand",
          "box",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const PLACEHOLDER_POOL: (ClothingAttributes & { name: string })[] = [
  {
    name: "White T-shirt",
    category: "top",
    layeringRole: "base_layer",
    warmth: "low",
    color: "white",
    pattern: "solid",
    material: "cotton",
    formality: "casual",
    season: "all-season",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder top",
  },
  {
    name: "Blue jeans",
    category: "bottom",
    layeringRole: "bottom",
    warmth: "medium",
    color: "indigo",
    pattern: "solid",
    material: "denim",
    formality: "casual",
    season: "all-season",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder bottom",
  },
  {
    name: "Gray hoodie",
    category: "top",
    layeringRole: "mid_layer",
    warmth: "medium",
    color: "gray",
    pattern: "solid",
    material: "cotton fleece",
    formality: "casual",
    season: "fall",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder mid layer",
  },
  {
    name: "Black jacket",
    category: "outerwear",
    layeringRole: "outer_layer",
    warmth: "high",
    color: "black",
    pattern: "solid",
    material: "polyester",
    formality: "casual",
    season: "fall",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder outer layer",
  },
  {
    name: "Black sneakers",
    category: "shoes",
    layeringRole: "shoes",
    warmth: "low",
    color: "black",
    pattern: "solid",
    material: "canvas",
    formality: "casual",
    season: "all-season",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder shoes",
  },
  {
    name: "Brown handbag",
    category: "accessory",
    layeringRole: "accessory",
    warmth: "low",
    color: "brown",
    pattern: "solid",
    material: "leather",
    formality: "smart-casual",
    season: "all-season",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder accessory",
  },
];

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * No API key configured: fake a plausible multi-item detection (2-5 items from a
 * fixed pool, laid out in a simple non-overlapping grid) so the review/confirm flow
 * still works end to end for free. Swapping in a real ANTHROPIC_API_KEY later
 * switches to real detection with no other changes.
 */
function detectClothingItemsPlaceholder(): DetectedItem[] {
  const count = 2 + Math.floor(Math.random() * 4); // 2-5 items
  const chosen = shuffled(PLACEHOLDER_POOL).slice(0, count);
  const cols = Math.ceil(Math.sqrt(chosen.length));
  const rows = Math.ceil(chosen.length / cols);
  const pad = 0.06;

  return chosen.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const w = 1 / cols;
    const h = 1 / rows;
    return {
      ...item,
      boundingBox: {
        x: col * w + pad * w,
        y: row * h + pad * h,
        width: w * (1 - 2 * pad),
        height: h * (1 - 2 * pad),
      },
    };
  });
}

export async function detectClothingItems(image: SavedImage, size?: ImageSize): Promise<DetectedItem[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return detectClothingItemsPlaceholder();
  }
  // Without the real size (older app versions), use a 1000 x 1000 grid over the image instead.
  const grid = size ?? { width: 1000, height: 1000 };

  const message = await anthropic.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 8000,
    output_config: {
      format: { type: "json_schema", schema: DETECT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
          {
            type: "text",
            text: [
              "This photo may show several distinct clothing or accessory items laid out separately",
              "(on a bed, floor, hanger, flat surface, etc.), worn by a person, or just one item.",
              "Identify EACH distinct item visible. Do not group multiple items into a single entry",
              "— a photo of a shirt and jeans side by side must produce two separate items, not one",
              "'outfit'. For each item, give its category, layering role (base/mid/outer layer, bottom,",
              "one-piece, shoes, or accessory — e.g. a t-shirt is base_layer, a hoodie or cardigan is",
              "mid_layer, a jacket or coat is outer_layer), warmth level, color, pattern, material,",
              "formality, season, a short name and description, and a tight box around just that item.",
              size
                ? `The image is ${grid.width} x ${grid.height} pixels; give each box in those pixels, (0,0) at the top-left.`
                : `Give each box on a ${grid.width} x ${grid.height} grid laid over the image, (0,0) at the top-left.`,
              "Only list items you can actually see; skip anything hidden, cut off, or too small to make out.",
              "Give a brand only when a logo, label or printed brand name is clearly visible on that item; otherwise leave it empty.",
              "If you can't confidently identify any distinct clothing items, return an empty items array.",
            ].join(" "),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { items: (Omit<DetectedItem, "boundingBox"> & { box: PixelBox })[] };
  return parsed.items.flatMap(({ box, ...item }) => {
    const boundingBox = toFractions(box, grid);
    return boundingBox ? [{ ...item, brand: cleanBrand(item.brand), boundingBox }] : [];
  });
}

/** One close-up per detected item: a roomy cut-out around where detection thought the item was. */
export type CheckCrop = { name: string; description: string; image: SavedImage; size: ImageSize };
/** found = the item really is in its close-up; box = where, as fractions of the close-up. */
export type CheckResult = { found: boolean; box: BoundingBox | null };

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          image: { type: "integer", description: "The close-up's number" },
          found: { type: "boolean", description: "True only if the named item is clearly in this close-up" },
          box: PIXEL_BOX_SCHEMA,
        },
        required: ["image", "found", "box"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

/**
 * Second look: detection's boxes can be off (an elbow labelled as sunglasses), so each close-up is checked for the
 * item it's meant to show, and a tight box is found inside it. Items that aren't there come back found: false.
 */
export async function checkDetectedItems(crops: CheckCrop[]): Promise<CheckResult[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return crops.map(() => ({ found: true, box: null }));
  }

  const content: Anthropic.ContentBlockParam[] = [];
  crops.forEach((crop, i) => {
    content.push({
      type: "text",
      text: `Close-up ${i + 1} (${crop.size.width} x ${crop.size.height} pixels) should show: ${crop.name} — ${crop.description}`,
    });
    content.push({ type: "image", source: { type: "base64", media_type: crop.image.mediaType, data: crop.image.base64 } });
  });
  content.push({
    type: "text",
    text: [
      "Each close-up was cut from a larger clothing photo around where an item was thought to be.",
      "For each one, say whether that exact item (right kind of garment, roughly the right color) is clearly in it.",
      "Say false if the close-up mostly shows something else, such as skin, a different garment, or background,",
      "or if only a tiny sliver of the item is there. When true, give a tight box around just that item in that",
      "close-up's own pixels, (0,0) at its top-left. When false, give a box of all zeros.",
      "Answer once for every close-up, by its number.",
    ].join(" "),
  });

  const message = await anthropic.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: CHECK_SCHEMA } },
    messages: [{ role: "user", content }],
  });

  const parsed = JSON.parse(firstText(message)) as { results: { image: number; found: boolean; box: PixelBox }[] };
  const byNumber = new Map(parsed.results.map((r) => [r.image, r]));
  // Anything the answer skipped counts as not found, so an unchecked picture is never saved.
  return crops.map((crop, i) => {
    const r = byNumber.get(i + 1);
    if (!r?.found) return { found: false, box: null };
    const box = toFractions(r.box, crop.size);
    return box ? { found: true, box } : { found: false, box: null };
  });
}
