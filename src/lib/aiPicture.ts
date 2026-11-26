/**
 * The picture of a closet piece that AI work uses (try-on, live try-on, tagging): always the piece's own picture,
 * never the AI-enhanced one. Tidying a picture can blur a logo or shift a color, and that mustn't spread into
 * try-ons. It also means switching the ✦ picture never changes which try-ons count as the same (no new cost).
 */
type WithPictures = { imageUrl: string; plainUrl?: string | null; enhancedUrl?: string | null };

export function aiPicture(piece: WithPictures): string {
  return piece.enhancedUrl && piece.plainUrl && piece.imageUrl === piece.enhancedUrl ? piece.plainUrl : piece.imageUrl;
}

/**
 * Flag (on since 2026-11-25, after one paid test): photo try-ons of jeans, trousers, shorts and skirts use the tidied, laid-flat picture when the
 * person chose to show it (✦ on), instead of the original. The try-on AI (vto-v2) copies the garment picture closely,
 * and a pair of jeans photographed held up or bunched shows a gathered, shadowed front (fly, zip, folds) that it then
 * draws as a long, puffy fly on the person. A flat product-style picture of the same jeans doesn't have that.
 * Turning it on changes which try-ons count as the same for those outfits, so each is made fresh once (a paid call).
 */
export const FLAT_BOTTOMS_FOR_TRYON = true;

/** The picture photo try-on sends for a piece: `aiPicture`, except bottoms showing their flat picture (see the flag). */
export function tryOnPicture(piece: WithPictures & { layeringRole?: string | null }): string {
  if (FLAT_BOTTOMS_FOR_TRYON && piece.layeringRole === "bottom" && piece.enhancedUrl && piece.imageUrl === piece.enhancedUrl) {
    return piece.enhancedUrl;
  }
  return aiPicture(piece);
}
