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

export { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES, WARMTH_LEVELS, type ClothingAttributes };

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
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
  },
  required: [
    "category",
    "layeringRole",
    "warmth",
    "color",
    "pattern",
    "material",
    "formality",
    "season",
    "description",
  ],
  additionalProperties: false,
};

const PLACEHOLDER_POOL: ClothingAttributes[] = [
  {
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
    category: "outerwear",
    layeringRole: "outer_layer",
    warmth: "high",
    color: "black",
    pattern: "solid",
    material: "wool",
    formality: "smart-casual",
    season: "fall",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder outerwear",
  },
  {
    category: "shoes",
    layeringRole: "shoes",
    warmth: "low",
    color: "white",
    pattern: "solid",
    material: "canvas",
    formality: "casual",
    season: "all-season",
    description: "Demo item (no ANTHROPIC_API_KEY set) — placeholder shoes",
  },
];

/**
 * No API key configured: cycle through a small fixed pool instead of calling Claude,
 * so the upload -> closet loop still works end to end for free. Swapping in a real
 * ANTHROPIC_API_KEY later switches to real classification with no other changes.
 */
function classifyClothingImagePlaceholder(): ClothingAttributes {
  const pick = PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)];
  return { ...pick };
}

export async function classifyClothingImage(image: SavedImage): Promise<ClothingAttributes> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return classifyClothingImagePlaceholder();
  }

  const message = await anthropic.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 512,
    output_config: {
      format: { type: "json_schema", schema: CLASSIFY_SCHEMA },
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
            text: "This is a single item of clothing from someone's closet. Identify its category, layering role (base/mid/outer layer, bottom, one-piece, shoes, or accessory), warmth level, color, pattern, material, formality, and season, and write a short description.",
          },
        ],
      },
    ],
  });

  return JSON.parse(firstText(message)) as ClothingAttributes;
}
