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

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * No API key configured: pair items with simple category rules (one top/dress +
 * one bottom, plus outerwear/shoes if available) instead of calling Claude, so the
 * outfit loop still works end to end for free. Swapping in a real ANTHROPIC_API_KEY
 * later switches to real AI-generated outfits with no other changes.
 */
function generateOutfitsFromClosetPlaceholder(closet: ClothingItem[]): GeneratedOutfit[] {
  const byCategory = (category: string) => closet.filter((item) => item.category === category);

  const outfits: GeneratedOutfit[] = [];
  for (let i = 0; i < 3; i++) {
    const base = pickRandom(byCategory("dress")) ?? undefined;
    const top = base ? undefined : pickRandom(byCategory("top"));
    const bottom = base ? undefined : pickRandom(byCategory("bottom"));
    const outerwear = pickRandom(byCategory("outerwear"));
    const shoes = pickRandom(byCategory("shoes"));

    const chosen = [base, top, bottom, outerwear, shoes].filter(
      (item): item is ClothingItem => item !== undefined
    );

    if (chosen.length < 2) {
      const fallback = [...closet].sort(() => Math.random() - 0.5).slice(0, 2);
      chosen.push(...fallback.filter((item) => !chosen.includes(item)));
    }

    const itemIds = [...new Set(chosen.map((item) => item.id))];
    if (itemIds.length < 2) continue;
    if (outfits.some((o) => o.itemIds.join() === itemIds.join())) continue;

    outfits.push({
      itemIds,
      rationale: "Demo pairing (no ANTHROPIC_API_KEY set) — items grouped by basic category rules, not AI-styled.",
    });
  }

  return outfits.length > 0 ? outfits : [];
}

export async function generateOutfitsFromCloset(
  closet: ClothingItem[],
  prompt?: string
): Promise<GeneratedOutfit[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateOutfitsFromClosetPlaceholder(closet);
  }

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
