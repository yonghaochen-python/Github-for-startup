import { LAYERING_ROLES } from "@/lib/clothingTaxonomy";

export type LayeringRole = (typeof LAYERING_ROLES)[number];

/** Visual/physical stacking order: outermost first, matching how a styled outfit is presented. */
export const LAYER_ORDER: LayeringRole[] = [
  "outer_layer",
  "mid_layer",
  "base_layer",
  "one_piece",
  "bottom",
  "shoes",
  "accessory",
];

export const LAYER_LABELS: Record<LayeringRole, string> = {
  outer_layer: "Outer layer",
  mid_layer: "Mid layer",
  base_layer: "Base layer",
  one_piece: "One-piece",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

export function groupByLayer<T extends { layeringRole: string }>(
  items: T[]
): Partial<Record<LayeringRole, T[]>> {
  const groups: Partial<Record<LayeringRole, T[]>> = {};
  for (const item of items) {
    const role = item.layeringRole as LayeringRole;
    (groups[role] ??= []).push(item);
  }
  return groups;
}

/** The outfit's items grouped by role, in outer-to-accessory visual order, skipping empty roles. */
export function orderedLayerEntries<T extends { layeringRole: string }>(items: T[]): { role: LayeringRole; items: T[] }[] {
  const groups = groupByLayer(items);
  return LAYER_ORDER.filter((role) => groups[role]?.length).map((role) => ({ role, items: groups[role]! }));
}

/**
 * Hard structural rule: a one-piece garment (dress/jumpsuit) already covers the
 * lower body, so a separate bottom alongside it is never a sensible combination —
 * drop it as a safety net regardless of what the model proposed. Nuanced taste
 * judgments (fit, bulk, thickness) are left to the model's own reasoning in the
 * generation prompt rather than encoded here.
 */
export function sanitizeLayeredOutfit<T extends { layeringRole: string }>(items: T[]): T[] {
  const hasOnePiece = items.some((i) => i.layeringRole === "one_piece");
  if (!hasOnePiece) return items;
  return items.filter((i) => i.layeringRole !== "bottom");
}
