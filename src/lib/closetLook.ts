import { sanitizeLayeredOutfit } from "@/lib/layering";
import type { ClothingItem } from "@/generated/prisma/client";

/**
 * A look from the person's own closet, styled by the AI: the pieces, why each suits them, and other closet pieces of
 * the same kind to swap in (so swapping one costs nothing). Used by Virm Studio's Personal Style Guide.
 */

export type StyledPiece = { itemId: string; why: string; alternates: string[] };
export type StyledLook = { pieces: StyledPiece[]; rationale: string; occasion: string | null; practice?: boolean };

export const LOOK_PROPERTIES = {
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

export const LOOK_SCHEMA = { type: "object", properties: LOOK_PROPERTIES, required: ["pieces", "rationale"], additionalProperties: false };

export const LOOK_RULES = [
  "Build ONE complete outfit from the closet below that best suits this person: colors from their palette near",
  "the face, and cuts and fabrics that fit their style direction. A complete outfit is a top and bottom",
  "(or a one-piece) plus shoes when the closet has them; add a layer or accessory only when it helps. Use only",
  "ids from the closet. Never put a bottom with a one_piece. For each piece list same-category alternates from",
  "the closet that would also suit them.",
].join(" ");

export const inventoryOf = (closet: ClothingItem[]) =>
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
export function cleanLook(raw: { pieces: StyledPiece[]; rationale: string }, closet: ClothingItem[], occasion: string | null): StyledLook | null {
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

/** Practice mode (free, no AI): a look picked by simple rules. */
export function practiceLook(closet: ClothingItem[], occasion: string | null): StyledLook {
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
