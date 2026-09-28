import { anthropic, CLASSIFY_MODEL, firstText } from "@/lib/anthropic";
import type { SavedImage } from "@/lib/images";

export const CATEGORIES = ["top", "bottom", "outerwear", "shoes", "accessory", "dress"] as const;
export const FORMALITIES = ["casual", "smart-casual", "formal", "athletic"] as const;
export const SEASONS = ["spring", "summer", "fall", "winter", "all-season"] as const;

export type ClothingAttributes = {
  category: (typeof CATEGORIES)[number];
  color: string;
  pattern: string;
  material: string;
  formality: (typeof FORMALITIES)[number];
  season: (typeof SEASONS)[number];
  description: string;
};

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORIES },
    color: { type: "string", description: "Primary color(s), e.g. 'navy' or 'white and red'" },
    pattern: { type: "string", description: "e.g. 'solid', 'striped', 'plaid', 'floral'" },
    material: { type: "string", description: "Best guess, e.g. 'cotton', 'denim', 'leather'" },
    formality: { type: "string", enum: FORMALITIES },
    season: { type: "string", enum: SEASONS },
    description: { type: "string", description: "Short shopper-style description, under 10 words" },
  },
  required: ["category", "color", "pattern", "material", "formality", "season", "description"],
  additionalProperties: false,
};

export async function classifyClothingImage(image: SavedImage): Promise<ClothingAttributes> {
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
            text: "This is a single item of clothing from someone's closet. Identify its category, color, pattern, material, formality, and season, and write a short description.",
          },
        ],
      },
    ],
  });

  return JSON.parse(firstText(message)) as ClothingAttributes;
}
