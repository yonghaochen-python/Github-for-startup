/**
 * The picture of a closet piece that AI work uses (try-on, live try-on, tagging): always the piece's own picture,
 * never the AI-enhanced one. Tidying a picture can blur a logo or shift a color, and that mustn't spread into
 * try-ons. It also means switching the ✦ picture never changes which try-ons count as the same (no new cost).
 */
type WithPictures = { imageUrl: string; plainUrl?: string | null; enhancedUrl?: string | null };

export function aiPicture(piece: WithPictures): string {
  return piece.enhancedUrl && piece.plainUrl && piece.imageUrl === piece.enhancedUrl ? piece.plainUrl : piece.imageUrl;
}
