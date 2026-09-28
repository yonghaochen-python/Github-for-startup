import { anthropic, OUTFIT_MODEL, firstText } from "@/lib/anthropic";
import type { ClothingItem } from "@/generated/prisma/client";

const OUTFITS_SCHEMA = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          itemIds: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            description: "IDs of closet items that make up this outfit",
          },
          rationale: {
            type: "string",
            description: "One or two sentences on why these items work together",
          },
        },
        required: ["itemIds", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["outfits"],
  additionalProperties: false,
};

export type GeneratedOutfit = {
  itemIds: string[];
  rationale: string;
};

export async function generateOutfitsFromCloset(
  closet: ClothingItem[],
  prompt?: string
): Promise<GeneratedOutfit[]> {
  const inventory = closet.map((item) => ({
    id: item.id,
    category: item.category,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    season: item.season,
    description: item.description,
  }));

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 1024,
    output_config: {
      format: { type: "json_schema", schema: OUTFITS_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Here is a person's digital closet, as JSON:",
              JSON.stringify(inventory, null, 2),
              "",
              "Propose 1-3 complete outfits using only items from this closet (reference them by id).",
              "Each outfit should make sense together (color, formality, season) and use at least two items.",
              prompt ? `Occasion / preference from the user: ${prompt}` : "No specific occasion given — suggest versatile everyday outfits.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { outfits: GeneratedOutfit[] };
  return parsed.outfits;
}
