/**
 * The Stylist's vocabulary, shared by the page and the server: undertones, body shapes, the reading and look shapes,
 * and the color palettes used when a person corrects their undertone.
 */

export const UNDERTONES = ["warm", "cool", "neutral", "olive"] as const;
export type Undertone = (typeof UNDERTONES)[number];

export const BODY_SHAPES = ["hourglass", "rectangle", "triangle", "inverted_triangle", "oval"] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

export const BODY_SHAPE_LABELS: Record<BodyShape, string> = {
  hourglass: "Hourglass",
  rectangle: "Straight (rectangle)",
  triangle: "Pear (triangle)",
  inverted_triangle: "Broad shoulders (inverted triangle)",
  oval: "Round middle (oval)",
};

export type Swatch = { name: string; hex: string };

export type StyleReading = {
  undertone: Undertone;
  undertoneWhy: string;
  contrast: "low" | "medium" | "high";
  colorSeason: string;
  bestColors: Swatch[];
  avoidColors: Swatch[];
  bodyShape: BodyShape;
  bodyNotes: string;
  /** Cuts and shapes that flatter ("high-rise straight-leg trousers"). */
  fits: string[];
  materials: string[];
  patterns: string;
  summary: string;
  /** Pieces worth looking for that the closet doesn't have yet. */
  shoppingIdeas: string[];
  practice?: boolean;
};

export type Corrections = { undertone?: Undertone; bodyShape?: BodyShape };

/** A styled piece: why it suits the person, and other closet pieces of the same kind to swap in. */
export type StyledPiece = { itemId: string; why: string; alternates: string[] };
export type StyledLook = { pieces: StyledPiece[]; rationale: string; occasion: string | null; practice?: boolean };

/** Colors that suit each undertone, used when the person corrects the AI's reading (so no new AI call is needed). */
export const PALETTES: Record<Undertone, { best: Swatch[]; avoid: Swatch[] }> = {
  warm: {
    best: [
      { name: "Camel", hex: "#C19A6B" },
      { name: "Olive", hex: "#708238" },
      { name: "Rust", hex: "#B7410E" },
      { name: "Cream", hex: "#F3EBD3" },
      { name: "Mustard", hex: "#D9A404" },
      { name: "Chocolate", hex: "#5C3A21" },
      { name: "Coral", hex: "#F27B5B" },
      { name: "Teal", hex: "#0F7C7C" },
    ],
    avoid: [
      { name: "Icy grey", hex: "#D6DEE5" },
      { name: "Fuchsia", hex: "#D1349B" },
      { name: "Pure black", hex: "#0B0B0B" },
    ],
  },
  cool: {
    best: [
      { name: "Navy", hex: "#1F2A44" },
      { name: "Charcoal", hex: "#36454F" },
      { name: "Emerald", hex: "#046307" },
      { name: "Cobalt", hex: "#0047AB" },
      { name: "Berry", hex: "#8E3A59" },
      { name: "Lavender", hex: "#A98BD6" },
      { name: "Crisp white", hex: "#FAFAFA" },
      { name: "Rose pink", hex: "#E58FAD" },
    ],
    avoid: [
      { name: "Orange", hex: "#E67E22" },
      { name: "Mustard", hex: "#D9A404" },
      { name: "Camel", hex: "#C19A6B" },
    ],
  },
  neutral: {
    best: [
      { name: "Soft white", hex: "#F5F3EE" },
      { name: "Taupe", hex: "#8B7D6B" },
      { name: "Denim blue", hex: "#5D7FA3" },
      { name: "Sage", hex: "#9CAF88" },
      { name: "Dusty rose", hex: "#C9A9A6" },
      { name: "Jade", hex: "#00A86B" },
      { name: "Plum", hex: "#673147" },
      { name: "Charcoal", hex: "#36454F" },
    ],
    avoid: [
      { name: "Neon yellow", hex: "#E6F21F" },
      { name: "Bright orange", hex: "#FF6F00" },
    ],
  },
  olive: {
    best: [
      { name: "Forest green", hex: "#2E4D2F" },
      { name: "Terracotta", hex: "#C8603F" },
      { name: "Chocolate", hex: "#4E3524" },
      { name: "Gold", hex: "#C9A227" },
      { name: "Ivory", hex: "#F6F1E1" },
      { name: "Burgundy", hex: "#7A1C2E" },
      { name: "Deep teal", hex: "#014D4E" },
      { name: "Khaki", hex: "#8F8A5B" },
    ],
    avoid: [
      { name: "Pastel yellow", hex: "#F7EFA0" },
      { name: "Baby pink", hex: "#F4C2D2" },
      { name: "Lime", hex: "#B5D33D" },
    ],
  },
};

/** The reading with the person's corrections applied (a corrected undertone brings its own palette). */
export function withCorrections(reading: StyleReading, corrections: Corrections): StyleReading {
  const out = { ...reading };
  if (corrections.undertone && corrections.undertone !== reading.undertone) {
    out.undertone = corrections.undertone;
    out.undertoneWhy = "You set this yourself.";
    // The AI's seasonal type came from its own undertone reading, so it no longer applies.
    out.colorSeason = `${corrections.undertone.charAt(0).toUpperCase()}${corrections.undertone.slice(1)} palette`;
    out.bestColors = PALETTES[corrections.undertone].best;
    out.avoidColors = PALETTES[corrections.undertone].avoid;
  }
  if (corrections.bodyShape) out.bodyShape = corrections.bodyShape;
  return out;
}
