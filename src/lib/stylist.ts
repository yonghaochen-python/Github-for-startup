import { anthropic, OUTFIT_MODEL, firstText } from "@/lib/anthropic";
import { isDevMode } from "@/lib/auth";
import { sanitizeLayeredOutfit } from "@/lib/layering";
import type { ClothingItem } from "@/generated/prisma/client";
import {
  BODY_SHAPES,
  PALETTES,
  UNDERTONES,
  withCorrections,
  type Corrections,
  type StyleReading,
  type StyledLook,
  type StyledPiece,
} from "@/lib/styleProfile";

export { BODY_SHAPES, UNDERTONES, withCorrections, type Corrections, type StyleReading, type StyledLook, type StyledPiece };

/**
 * The Stylist: reads one photo the person chose (undertone, contrast, body shape and proportions) and styles a
 * look from their closet that suits them. One AI call does both. Only the written results are kept, never the photo.
 *
 * Practice mode (no AI, no cost): on a local copy of the app, or when no AI key is set. It returns a sample reading
 * and a look picked by simple rules, clearly marked, so the page can be tried for free.
 */

export const parseJson = <T>(json: string | null, fallback: T): T => {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** The person's style profile as the page shows it: the reading with their corrections applied, and the look. */
export function profileView(row: { reading: string; corrections: string; look: string | null; updatedAt: Date }) {
  const reading = parseJson<StyleReading | null>(row.reading, null);
  const corrections = parseJson<Corrections>(row.corrections, {});
  return reading
    ? { reading: withCorrections(reading, corrections), aiReading: { undertone: reading.undertone, bodyShape: reading.bodyShape }, corrections, look: parseJson<StyledLook | null>(row.look, null), updatedAt: row.updatedAt }
    : null;
}

/* ---------- What the AI is asked ---------- */

const swatch = {
  type: "object",
  properties: { name: { type: "string" }, hex: { type: "string", description: "#RRGGBB" } },
  required: ["name", "hex"],
  additionalProperties: false,
};

const LOOK_PROPERTIES = {
  pieces: {
    type: "array",
    description: "The look, one entry per closet item worn (2 to 6 items, using only ids from the closet)",
    items: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        why: { type: "string", description: "One short sentence on why this piece suits this person (color, cut or fabric)" },
        alternates: {
          type: "array",
          items: { type: "string" },
          description: "Up to 3 other closet item ids of the same category that would also suit them, best first",
        },
      },
      required: ["itemId", "why", "alternates"],
      additionalProperties: false,
    },
  },
  rationale: { type: "string", description: "One or two sentences on why the look works for this person" },
};

const READING_SCHEMA = {
  type: "object",
  properties: {
    photoUsable: { type: "boolean", description: "False if the photo doesn't clearly show one person well enough to read" },
    photoIssue: { type: "string", description: "When not usable: what to change, kindly and briefly (else empty)" },
    undertone: { type: "string", enum: [...UNDERTONES] },
    undertoneWhy: { type: "string", description: "One short sentence: what in the photo suggests it" },
    contrast: { type: "string", enum: ["low", "medium", "high"], description: "Contrast between skin, hair and eyes" },
    colorSeason: { type: "string", description: "Seasonal color type, e.g. 'Soft Autumn'" },
    bestColors: { type: "array", items: swatch, description: "8 colors that flatter them" },
    avoidColors: { type: "array", items: swatch, description: "3 colors to keep away from the face" },
    bodyShape: { type: "string", enum: [...BODY_SHAPES] },
    bodyNotes: { type: "string", description: "One or two kind sentences about proportions and what to highlight" },
    fits: { type: "array", items: { type: "string" }, description: "4 to 6 specific cuts and shapes that flatter them" },
    materials: { type: "array", items: { type: "string" }, description: "3 to 5 fabrics or textures that suit them" },
    patterns: { type: "string", description: "One sentence on pattern scale and type" },
    summary: { type: "string", description: "Two sentences: their style direction in a nutshell" },
    shoppingIdeas: { type: "array", items: { type: "string" }, description: "Up to 3 pieces worth adding that the closet lacks" },
    look: { type: "object", properties: LOOK_PROPERTIES, required: ["pieces", "rationale"], additionalProperties: false },
  },
  required: [
    "photoUsable",
    "photoIssue",
    "undertone",
    "undertoneWhy",
    "contrast",
    "colorSeason",
    "bestColors",
    "avoidColors",
    "bodyShape",
    "bodyNotes",
    "fits",
    "materials",
    "patterns",
    "summary",
    "shoppingIdeas",
    "look",
  ],
  additionalProperties: false,
};

const LOOK_SCHEMA = { type: "object", properties: LOOK_PROPERTIES, required: ["pieces", "rationale"], additionalProperties: false };

const STYLIST_VOICE = [
  "You are an experienced personal stylist and color analyst. You are warm, specific and practical.",
  "Body shape is about proportions (shoulders, waist, hips, leg line), never weight or size. Never comment on",
  "weight, attractiveness, age, ethnicity or anything to 'hide'; talk about what to highlight and balance.",
  "Undertone comes from skin, veins, hair and eyes; lighting can mislead, so read it carefully and say why.",
  "Be concrete: name cuts, rises, necklines, lengths and fabrics, not vague advice.",
].join(" ");

const LOOK_RULES = [
  "Build ONE complete outfit from the closet below that best suits this person: colors from their palette near",
  "the face, cuts that flatter their proportions, fabrics that suit them. A complete outfit is a top and bottom",
  "(or a one-piece) plus shoes when the closet has them; add a layer or accessory only when it helps. Use only",
  "ids from the closet. Never put a bottom with a one_piece. For each piece list same-category alternates from",
  "the closet that would also suit them.",
].join(" ");

const inventoryOf = (closet: ClothingItem[]) =>
  closet.slice(0, 150).map((item) => ({
    id: item.id,
    category: item.category,
    layeringRole: item.layeringRole,
    color: item.color,
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    season: item.season,
    description: item.description,
  }));

/** The AI is never trusted with ids: unknown or repeated pieces are dropped, alternates must be the same kind. */
function cleanLook(raw: { pieces: StyledPiece[]; rationale: string }, closet: ClothingItem[], occasion: string | null): StyledLook | null {
  const byId = new Map(closet.map((item) => [item.id, item]));
  const chosen = [...new Map(raw.pieces.filter((p) => byId.has(p.itemId)).map((p) => [p.itemId, p])).values()];
  const kept = new Set(sanitizeLayeredOutfit(chosen.map((p) => byId.get(p.itemId)!)).map((item) => item.id));
  const pieces = chosen
    .filter((p) => kept.has(p.itemId))
    .map((p) => {
      const category = byId.get(p.itemId)!.category;
      const alternates = [...new Set(p.alternates)].filter((id) => id !== p.itemId && !kept.has(id) && byId.get(id)?.category === category);
      return { itemId: p.itemId, why: p.why.slice(0, 240), alternates: alternates.slice(0, 3) };
    });
  return pieces.length >= 1 ? { pieces, rationale: raw.rationale.slice(0, 400), occasion } : null;
}

export class StylistError extends Error {
  constructor(
    public code: "photo_unusable" | "no_look" | "failed",
    message: string
  ) {
    super(message);
  }
}

const inPracticeMode = (): boolean => isDevMode() || !process.env.ANTHROPIC_API_KEY;

/* ---------- Practice mode (free, no AI) ---------- */

function practiceLook(closet: ClothingItem[], occasion: string | null): StyledLook {
  const order = ["one_piece", "base_layer", "mid_layer", "bottom", "outer_layer", "shoes"];
  const shuffled = [...closet].sort(() => Math.random() - 0.5);
  const picked: ClothingItem[] = [];
  for (const role of order) {
    const item = shuffled.find((i) => i.layeringRole === role);
    if (!item) continue;
    if (role === "base_layer" && picked.some((p) => p.layeringRole === "one_piece")) continue;
    if (role === "bottom" && picked.some((p) => p.layeringRole === "one_piece")) continue;
    if (role === "outer_layer" && Math.random() < 0.5) continue;
    if (role === "mid_layer" && picked.some((p) => p.layeringRole === "base_layer")) continue;
    picked.push(item);
  }
  const ids = new Set(picked.map((p) => p.id));
  return {
    pieces: picked.map((item) => ({
      itemId: item.id,
      why: "Practice pick (no AI): chosen by simple rules.",
      alternates: shuffled.filter((i) => i.category === item.category && !ids.has(i.id)).slice(0, 3).map((i) => i.id),
    })),
    rationale: "Practice look, picked by simple rules so the page can be tried for free.",
    occasion,
    practice: true,
  };
}

const PRACTICE_READING: StyleReading = {
  undertone: "neutral",
  undertoneWhy: "Practice result: no photo was read.",
  contrast: "medium",
  colorSeason: "Soft Summer",
  bestColors: PALETTES.neutral.best,
  avoidColors: PALETTES.neutral.avoid,
  bodyShape: "rectangle",
  bodyNotes: "Practice result: a sample of how proportion notes will read.",
  fits: ["High-rise straight-leg trousers", "Wrap or belted tops", "Cropped jackets that end at the waist", "V-necklines"],
  materials: ["Crisp cotton", "Fine-gauge knits", "Soft-structured wool"],
  patterns: "Medium-scale patterns with soft contrast.",
  summary: "Practice result. With the real stylist, this is a short summary of your style direction.",
  shoppingIdeas: ["A belted trench coat", "Dark straight-leg jeans"],
  practice: true,
};

/* ---------- The real stylist ---------- */

/** Reads the photo and styles a look from the closet, in one AI call. */
export async function readStyle(photo: { bytes: Uint8Array; mediaType: string }, closet: ClothingItem[]): Promise<{ reading: StyleReading; look: StyledLook | null }> {
  if (inPracticeMode()) return { reading: PRACTICE_READING, look: closet.length ? practiceLook(closet, null) : null };

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: READING_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: photo.mediaType as "image/jpeg", data: Buffer.from(photo.bytes).toString("base64") },
          },
          {
            type: "text",
            text: [
              STYLIST_VOICE,
              "",
              "This is a photo the person chose for a personal style reading. Read their undertone, contrast, color",
              "season and body shape, then advise on colors, cuts, fabrics and patterns.",
              "",
              closet.length ? LOOK_RULES : "Their closet is empty: return an empty pieces list and say so in the rationale.",
              "",
              "Their closet, as JSON:",
              JSON.stringify(inventoryOf(closet)),
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const parsed = JSON.parse(firstText(message)) as StyleReading & { photoUsable: boolean; photoIssue: string; look: { pieces: StyledPiece[]; rationale: string } };
  if (!parsed.photoUsable) {
    throw new StylistError("photo_unusable", parsed.photoIssue || "That photo was hard to read. Try a clear, full-length photo in daylight.");
  }
  const { photoUsable: _u, photoIssue: _i, look, ...reading } = parsed;
  void _u;
  void _i;
  return {
    reading: { ...reading, bestColors: reading.bestColors.slice(0, 10), avoidColors: reading.avoidColors.slice(0, 5) },
    look: closet.length ? cleanLook(look, closet, null) : null,
  };
}

/** A new look from the saved reading (text only, no photo), optionally for an occasion. */
export async function styleLook(reading: StyleReading, closet: ClothingItem[], occasion: string | null): Promise<StyledLook> {
  if (inPracticeMode() || reading.practice) return practiceLook(closet, occasion);

  const profile = {
    undertone: reading.undertone,
    contrast: reading.contrast,
    colorSeason: reading.colorSeason,
    bestColors: reading.bestColors.map((c) => c.name),
    avoidColors: reading.avoidColors.map((c) => c.name),
    bodyShape: reading.bodyShape,
    bodyNotes: reading.bodyNotes,
    fits: reading.fits,
    materials: reading.materials,
    patterns: reading.patterns,
  };
  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: LOOK_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              STYLIST_VOICE,
              "",
              "The person's style profile, as JSON:",
              JSON.stringify(profile),
              "",
              LOOK_RULES,
              occasion ? `Style it for: "${occasion}".` : "Make it a versatile everyday look, different from the obvious choice.",
              "",
              "Their closet, as JSON:",
              JSON.stringify(inventoryOf(closet)),
            ].join("\n"),
          },
        ],
      },
    ],
  });
  const look = cleanLook(JSON.parse(firstText(message)) as { pieces: StyledPiece[]; rationale: string }, closet, occasion);
  if (!look) throw new StylistError("no_look", "Couldn't put a look together from your closet. Try again or add a few more pieces.");
  return look;
}
