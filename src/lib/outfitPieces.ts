import type { ClothingItem } from "@/components/OutfitCard";

export const MAX_ACCESSORIES = 3;

/** Adds a piece to the look: it takes the place of the piece in the same slot (accessories stack, up to three). */
export function withPiece(pieces: ClothingItem[], item: ClothingItem): ClothingItem[] {
  const role = item.layeringRole;
  const kept = pieces.filter((p) => {
    if (role === "accessory") return true;
    if (p.layeringRole === role) return false;
    // A one-piece and a bottom don't go together.
    if (role === "one_piece" && p.layeringRole === "bottom") return false;
    if (role === "bottom" && p.layeringRole === "one_piece") return false;
    return true;
  });
  const accessories = kept.filter((p) => p.layeringRole === "accessory");
  const trimmed = role === "accessory" && accessories.length >= MAX_ACCESSORIES ? kept.filter((p) => p.id !== accessories[0].id) : kept;
  return [...trimmed, item];
}
