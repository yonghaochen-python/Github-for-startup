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
            description: "IDs of closet items that make up this outfit's layers (at least two)",
          },
          rationale: {
            type: "string",
            description: "One or two sentences on why these items and layers work together",
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
 * No API key configured: build a layering-aware outfit from simple rules instead of
 * calling Claude, so the outfit loop still works end to end for free. Mirrors the
 * real generator's structure (pick a base, optionally add mid/outer layers, add a
 * bottom unless it's a one-piece, add shoes/accessories) without any AI reasoning —
 * layers are included at random, not because of weather or occasion. Swapping in a
 * real ANTHROPIC_API_KEY later switches to real AI-styled, weather-aware layering
 * with no other changes.
 */
function generateOutfitsFromClosetPlaceholder(closet: ClothingItem[]): GeneratedOutfit[] {
  const byRole = (role: string) => closet.filter((item) => item.layeringRole === role);

  const outfits: GeneratedOutfit[] = [];
  for (let i = 0; i < 3; i++) {
    const onePiece = pickRandom(byRole("one_piece"));
    const base = onePiece ? undefined : pickRandom(byRole("base_layer"));
    const mid = Math.random() < 0.5 ? pickRandom(byRole("mid_layer")) : undefined;
    const outer = Math.random() < 0.4 ? pickRandom(byRole("outer_layer")) : undefined;
    const bottom = onePiece ? undefined : pickRandom(byRole("bottom"));
    const shoes = pickRandom(byRole("shoes"));
    const accessory = Math.random() < 0.4 ? pickRandom(byRole("accessory")) : undefined;

    const chosen = [onePiece, base, mid, outer, bottom, shoes, accessory].filter(
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
      rationale: "Demo pairing (no ANTHROPIC_API_KEY set) — layers picked by basic rules, not AI-styled.",
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

const LAYERING_INSTRUCTIONS = [
  "An outfit is a structured set of layers, not just a pile of compatible items. Every closet item has a",
  "layeringRole: base_layer (t-shirts, tanks, undershirts), mid_layer (long sleeves, shirts, hoodies,",
  "sweaters, sweatshirts, cardigans), outer_layer (jackets, coats, blazers, trench coats), bottom (pants,",
  "jeans, skirts, shorts), one_piece (dresses, jumpsuits), shoes, or accessory — plus a warmth level",
  "(low/medium/high).",
  "",
  "First decide which layers this outfit actually needs, based on the weather/temperature, occasion, and",
  "requested style — THEN pick items for those layers. Do not force a layer that isn't needed: warm",
  "weather or an indoor casual occasion often needs only a base_layer (or one_piece) + bottom + shoes,",
  "with no mid or outer layer at all. Cooler weather adds a mid_layer (e.g. a hoodie). Cold weather adds",
  "both a mid_layer and an outer_layer over it. Use temperature as a strong signal when given a number:",
  "roughly, above ~70°F needs no mid/outer layer, ~55-70°F usually wants one added layer (mid OR outer),",
  "below ~55°F usually wants both a mid_layer and an outer_layer.",
  "",
  "A one_piece item (dress/jumpsuit) already covers the torso and legs — do not add a base_layer or a",
  "bottom underneath it unless the person's request explicitly asks for that styling (e.g. 'dress over a",
  "shirt'). It's fine to still add an outer_layer, shoes, and accessories over a one_piece.",
  "",
  "Layering compatibility: an outer_layer can go over a base_layer, a mid_layer, or both stacked together.",
  "Avoid combinations that would be physically bulky or unrealistic — e.g. a high-warmth mid_layer (a",
  "thick sweater) usually should not be forced underneath an outer_layer described as fitted or slim; a",
  "lighter base_layer or a looser outer_layer is a better pairing in that case. Never invent an item —",
  "use ONLY items that are actually listed in the closet JSON below, referenced by their id. If the closet",
  "genuinely has no good option for a layer (e.g. no hoodie exists), leave that layer out rather than",
  "inventing one or mislabeling a different item as it.",
].join(" ");

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
    layeringRole: item.layeringRole,
    warmth: item.warmth,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    season: item.season,
    description: item.description,
  }));

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 8000,
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
              LAYERING_INSTRUCTIONS,
              "",
              "Here is a person's digital closet, as JSON:",
              JSON.stringify(inventory, null, 2),
              "",
              "Propose exactly 3 complete, distinct outfits using only items from this closet (reference them by id).",
              "Each outfit should make sense together as a layered whole (color, formality, season, warmth) and",
              "use at least two items. Different outfits may use different layering combinations — for example",
              "one outfit with just a base layer, and another that adds a mid layer or an outer layer — rather",
              "than all 3 outfits using the identical layer structure.",
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
    layeringRole: item.layeringRole,
    warmth: item.warmth,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    season: item.season,
    description: item.description,
  }));

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 2000,
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
              "This outfit was just updated. Here are its items and layers, as JSON:",
              JSON.stringify(inventory, null, 2),
              "",
              "Write a short one or two sentence explanation of why these pieces and layers work together.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as { rationale: string };
  return parsed.rationale;
}
