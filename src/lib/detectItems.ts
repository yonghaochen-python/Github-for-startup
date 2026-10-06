import { anthropic, CLASSIFY_MODEL, firstText } from "@/lib/anthropic";
import type { SavedImage } from "@/lib/images";
import {
  CATEGORIES,
  FORMALITIES,
  SEASONS,
  LAYERING_ROLES,
  WARMTH_LEVELS,
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
          boundingBox: {
            type: "object",
            properties: {
              x: { type: "number", description: "Left edge, 0-1 fraction of image width" },
              y: { type: "number", description: "Top edge, 0-1 fraction of image height" },
              width: { type: "number", description: "0-1 fraction of image width" },
              height: { type: "number", description: "0-1 fraction of image height" },
            },
            required: ["x", "y", "width", "height"],
            additionalProperties: false,
          },
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
          "boundingBox",
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

export async function detectClothingItems(image: SavedImage): Promise<DetectedItem[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return detectClothingItemsPlaceholder();
  }

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
              "(on a bed, floor, hanger, flat surface, etc.), or it may show just one item.",
              "Identify EACH distinct item visible. Do not group multiple items into a single entry",
              "— a photo of a shirt and jeans side by side must produce two separate items, not one",
              "'outfit'. For each item, give its category, layering role (base/mid/outer layer, bottom,",
              "one-piece, shoes, or accessory — e.g. a t-shirt is base_layer, a hoodie or cardigan is",
              "mid_layer, a jacket or coat is outer_layer), warmth level, color, pattern, material,",
              "formality, season, a short name and description, and a tight bounding box as fractions of",
              "the image dimensions (0,0 is the top-left corner, 1,1 is the bottom-right corner).",
              "If you can't confidently identify any distinct clothing items, return an empty items array.",
            ].join(" "),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { items: DetectedItem[] };
  return parsed.items;
}
