import type { Swatch } from "@/lib/studioModules";

/**
 * How well a closet piece's color suits the person's palette, on the device (no AI). Pieces store their color as
 * words ("charcoal gray", "cream with pink"); the palette has hex codes. The words are matched to rough reference
 * colors, then compared with the palette: close to a color to wear scores high, close to one to go easy on scores
 * low, and neutrals (black, white, gray, denim…) sit in the middle so they're never pushed out.
 */

// Rough reference colors for the color words closets use (longer words are checked first).
const WORDS: [string, string][] = [
  ["off-white", "#F4F1E8"], ["ivory", "#F6F0DC"], ["cream", "#F3EBD3"], ["white", "#FAFAFA"], ["black", "#141414"],
  ["charcoal", "#3C3F44"], ["gray", "#8F9296"], ["grey", "#8F9296"], ["silver", "#C0C0C0"],
  ["navy", "#1F2A44"], ["light blue", "#A9C8E8"], ["sky", "#87BCE8"], ["denim", "#4A6A8A"], ["teal", "#0F7C7C"], ["turquoise", "#3CBFB4"], ["blue", "#3A66B0"],
  ["sage", "#9CAF88"], ["olive", "#708238"], ["mint", "#A8DCC0"], ["emerald", "#1E8A5A"], ["forest", "#2E5236"], ["khaki", "#B9A777"], ["green", "#4C8C4A"],
  ["mustard", "#D9A404"], ["yellow", "#EBCB4B"], ["gold", "#C9A341"],
  ["camel", "#C19A6B"], ["tan", "#C8A27A"], ["beige", "#D8C7A8"], ["taupe", "#8B7D6B"], ["chocolate", "#5C3A21"], ["dark brown", "#4A3020"], ["brown", "#7B5234"], ["rust", "#B7410E"], ["terracotta", "#C8603F"],
  ["orange", "#E67E30"], ["coral", "#F27B5B"], ["peach", "#F6B98E"],
  ["burgundy", "#6E1E2C"], ["wine", "#722F37"], ["maroon", "#6B1F2A"], ["red", "#C0302E"],
  ["blush", "#E8B4B0"], ["fuchsia", "#D1349B"], ["pink", "#E79AB0"], ["rose", "#C97B84"],
  ["lavender", "#B9A6D6"], ["lilac", "#C3A6D3"], ["plum", "#6E3B4E"], ["purple", "#6B4C9A"],
];
const NEUTRAL = /black|white|cream|ivory|off-white|gray|grey|charcoal|denim|beige|navy|tan|khaki|taupe/;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Perceptual-ish distance between two colors (0 = same, about 1 = far apart). */
function distance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const r = (r1 + r2) / 2;
  const d = Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2);
  return Math.min(1, d / 500);
}

/** The piece's main color as a hex, from its color words (the first color named wins), or null. */
export function colorOfWords(words: string | null | undefined): string | null {
  const text = (words ?? "").toLowerCase();
  let best: { at: number; hex: string } | null = null;
  for (const [word, hex] of WORDS) {
    const at = text.indexOf(word);
    if (at >= 0 && (!best || at < best.at)) best = { at, hex };
  }
  return best?.hex ?? null;
}

/** A weight for picking this piece (about 0.3 to 3): higher when it's in the person's colors. 1 when unknown. */
export function paletteWeight(colorWords: string | null | undefined, palette: { wear: Swatch[]; avoid: Swatch[] }): number {
  if (!palette.wear.length) return 1;
  const hex = colorOfWords(colorWords);
  if (!hex) return 1;
  const near = (list: Swatch[]) => (list.length ? Math.min(...list.map((s) => distance(hex, s.hex))) : 1);
  const wear = near(palette.wear);
  const avoid = near(palette.avoid);
  if (avoid < 0.08 && avoid < wear) return 0.3; // one of their go-easy colors
  if (wear < 0.12) return 3; // one of their colors
  if (NEUTRAL.test((colorWords ?? "").toLowerCase())) return 1.2; // neutrals go with everything
  return wear < 0.22 ? 1.6 : 0.8;
}

/** Color families for filtering, each with a dot color and the words that belong to it. */
export const COLOR_FAMILIES = [
  { id: "black", label: "Black", dot: "#141414", words: ["black", "charcoal", "onyx", "jet"] },
  { id: "white", label: "White & cream", dot: "#F3EBD3", words: ["white", "ivory", "cream", "off-white", "ecru"] },
  { id: "gray", label: "Gray", dot: "#8F9296", words: ["gray", "grey", "silver", "heather"] },
  { id: "brown", label: "Brown & beige", dot: "#A9825A", words: ["brown", "tan", "camel", "beige", "khaki", "taupe", "chocolate", "cognac", "nude", "sand"] },
  { id: "blue", label: "Blue", dot: "#3A66B0", words: ["blue", "navy", "denim", "teal", "turquoise", "sky", "indigo", "cobalt"] },
  { id: "green", label: "Green", dot: "#4C8C4A", words: ["green", "olive", "sage", "mint", "emerald", "forest", "khaki green"] },
  { id: "red", label: "Red & pink", dot: "#C0302E", words: ["red", "pink", "burgundy", "wine", "maroon", "coral", "rose", "blush", "fuchsia", "peach"] },
  { id: "yellow", label: "Yellow & orange", dot: "#E6A030", words: ["yellow", "mustard", "gold", "orange", "rust", "terracotta"] },
  { id: "purple", label: "Purple", dot: "#6B4C9A", words: ["purple", "lavender", "lilac", "plum", "violet", "mauve"] },
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number]["id"];

/** The families a piece belongs to, from its color words ("gray and cream" is in both). */
export function colorFamilies(words: string | null | undefined): ColorFamily[] {
  const text = (words ?? "").toLowerCase();
  return COLOR_FAMILIES.filter((f) => f.words.some((w) => text.includes(w))).map((f) => f.id);
}
