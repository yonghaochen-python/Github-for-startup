import { anthropic, OUTFIT_MODEL, firstText } from "@/lib/anthropic";
import type { ClothingItem } from "@/generated/prisma/client";

const OUTFITS_SCHEMA = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          itemIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "IDs of closet items that make up this outfit (at least two)",
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

const RATIONALE_SCHEMA = {
  type: "object",
  properties: {
    rationale: { type: "string", description: "One or two sentences on why these items work together" },
  },
  required: ["rationale"],
  additionalProperties: false,
};

export type GeneratedOutfit = {
  itemIds: string[];
  rationale: string;
};

export type OutfitRequest = {
  occasion?: string;
  weather?: string;
  style?: string;
  colorPreference?: string;
  prompt?: string;
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

  return outfits;
}

function describeRequest(request: OutfitRequest): string {
  const lines: string[] = [];
  if (request.occasion) lines.push(`Occasion: ${request.occasion}`);
  if (request.weather) lines.push(`Weather: ${request.weather}`);
  if (request.style) lines.push(`Preferred style: ${request.style}`);
  if (request.colorPreference) lines.push(`Color preference: ${request.colorPreference}`);
  if (request.prompt) lines.push(`Additional request: ${request.prompt}`);
  return lines.length > 0 ? lines.join("\n") : "No specific preferences given — suggest versatile everyday outfits.";
}

export async function generateOutfitsFromCloset(
  closet: ClothingItem[],
  request: OutfitRequest = {}
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
    max_tokens: 1536,
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
              "Propose exactly 3 complete, distinct outfits using only items from this closet (reference them by id).",
              "Each outfit should make sense together (color, formality, season) and use at least two items.",
              "If the closet doesn't have enough variety for 3 truly distinct outfits, it's fine to reuse an item across outfits.",
              "",
              describeRequest(request),
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { outfits: GeneratedOutfit[] };
  return parsed.outfits;
}

/** Re-explains a specific set of items, used after "Change One Item" swaps a piece. */
export async function explainOutfit(items: ClothingItem[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Demo pairing (no ANTHROPIC_API_KEY set) — swapped as requested, not AI-styled.";
  }

  const inventory = items.map((item) => ({
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
    max_tokens: 256,
    output_config: {
      format: { type: "json_schema", schema: RATIONALE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "This outfit was just updated. Here are its items, as JSON:",
              JSON.stringify(inventory, null, 2),
              "",
              "Write a short one or two sentence explanation of why these pieces work together.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { rationale: string };
  return parsed.rationale;
}
