import { anthropic, OUTFIT_MODEL, firstText } from "@/lib/anthropic";
import { isDevMode } from "@/lib/auth";
import { SEASONS, isHex, type ColorExtra, type NotedSwatch, type Season } from "@/lib/studioColor";
import type { StudioReportData } from "@/lib/studioModules";
import type { MakeupExtra } from "@/lib/studioMakeup";
import { JEWELRY, type Jewelry, type JewelryRating, type StyleExtra } from "@/lib/studioStyle";
import { LOOK_PROPERTIES, LOOK_RULES, cleanLook, inventoryOf, practiceLook, type StyledLook, type StyledPiece } from "@/lib/closetLook";
import type { ClothingItem } from "@/generated/prisma/client";

/**
 * The real Studio analyses: one AI call per module, reading the person's portrait and returning a structured report.
 * Text only (no image generation). Practice mode (no AI, no cost) on a local copy of the app or when no AI key is
 * set, so the pages can be tried for free.
 */

export type Analysis = { data: StudioReportData; practice: boolean; inputTokens?: number; outputTokens?: number; costMicros?: number };

export class PortraitUnusableError extends Error {}

export const inPracticeMode = (): boolean => isDevMode() || !process.env.ANTHROPIC_API_KEY;

/** Claude Sonnet 5's price as Virm's cost estimates use it (lib/businessCosts): $2 / $10 per million tokens in / out. */
const costMicros = (input: number, output: number) => input * 2 + output * 10;

const RESPECT = [
  "You are a warm, experienced color analyst and stylist writing for a premium fashion magazine.",
  "Describe only what is visible, neutrally and kindly. Never comment on attractiveness, weight, age, ethnicity, or",
  "personality, and never suggest changing someone's natural features. Seasonal color analysis is a styling tool,",
  "not science: present it as an informed recommendation. Lighting, filters and makeup can mislead; say so in the",
  "limits when they might, and lower your confidence when the photo is unclear.",
].join(" ");

const swatchSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    hex: { type: "string", description: "#RRGGBB" },
    note: { type: "string", description: "A few words on how it works with their coloring" },
  },
  required: ["name", "hex", "note"],
  additionalProperties: false,
};
const seasonRef = {
  type: "object",
  properties: { season: { type: "string", enum: [...SEASONS] }, subtype: { type: "string", description: "e.g. 'Soft Autumn', 'Light Spring'" } },
  required: ["season", "subtype"],
  additionalProperties: false,
};

const COLOR_SCHEMA = {
  type: "object",
  properties: {
    photoUsable: { type: "boolean", description: "False if no face is clearly visible" },
    photoIssue: { type: "string", description: "When not usable: what to change, kindly (else empty)" },
    seasons: {
      type: "array",
      description: "All four seasons, each scored 0-100 for how well its palette harmonizes with them",
      items: {
        type: "object",
        properties: { season: { type: "string", enum: [...SEASONS] }, score: { type: "integer" }, note: { type: "string", description: "One short sentence" } },
        required: ["season", "score", "note"],
        additionalProperties: false,
      },
    },
    primary: seasonRef,
    hasSecondary: { type: "boolean" },
    secondary: seasonRef,
    characteristics: {
      type: "object",
      properties: {
        undertone: { type: "string", description: "warm, cool, neutral or olive, with a word of nuance" },
        value: { type: "string", description: "light, medium or deep" },
        chroma: { type: "string", description: "soft/muted or clear/bright" },
        contrast: { type: "string", description: "low, medium or high, between skin, hair and eyes" },
      },
      required: ["undertone", "value", "chroma", "contrast"],
      additionalProperties: false,
    },
    headline: { type: "string", description: "A short editorial headline for their palette, 3-6 words" },
    summary: { type: "string", description: "Two or three sentences: their coloring and the recommendation" },
    explanation: { type: "string", description: "Why this season: what in their skin, hair and eyes points to it" },
    keywords: { type: "array", items: { type: "string" }, description: "4 to 6 aesthetic keywords for the palette (not personality)" },
    clothing: { type: "array", items: swatchSchema, description: "8 recommended clothing colors" },
    neutrals: { type: "array", items: swatchSchema, description: "4 or 5 neutrals" },
    accents: { type: "array", items: swatchSchema, description: "4 accent colors" },
    lessHarmonious: { type: "array", items: swatchSchema, description: "4 colors that may create less harmony near the face" },
    howToWear: { type: "string", description: "Two sentences of practical advice: where to place colors, combining them" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    limits: { type: "string", description: "What may have affected the reading (lighting, filters, makeup, hair dye), or empty" },
  },
  required: [
    "photoUsable",
    "photoIssue",
    "seasons",
    "primary",
    "hasSecondary",
    "secondary",
    "characteristics",
    "headline",
    "summary",
    "explanation",
    "keywords",
    "clothing",
    "neutrals",
    "accents",
    "lessHarmonious",
    "howToWear",
    "confidence",
    "limits",
  ],
  additionalProperties: false,
};

type ColorAnswer = {
  photoUsable: boolean;
  photoIssue: string;
  seasons: { season: Season; score: number; note: string }[];
  primary: { season: Season; subtype: string };
  hasSecondary: boolean;
  secondary: { season: Season; subtype: string };
  characteristics: ColorExtra["characteristics"];
  headline: string;
  summary: string;
  explanation: string;
  keywords: string[];
  clothing: NotedSwatch[];
  neutrals: NotedSwatch[];
  accents: NotedSwatch[];
  lessHarmonious: NotedSwatch[];
  howToWear: string;
  confidence: "high" | "medium" | "low";
  limits: string;
};

const clean = (list: NotedSwatch[], max: number) =>
  list
    .filter((s) => isHex(s.hex))
    .slice(0, max)
    .map((s) => ({ name: s.name.slice(0, 40), hex: s.hex.toUpperCase(), note: s.note?.slice(0, 120) ?? "" }));

/** The report as pages show it, from the AI's answer (or the practice answer). */
function colorReport(a: ColorAnswer): StudioReportData {
  // Every season once, in order, scores kept between 0 and 100.
  const seasons = SEASONS.map((season) => {
    const found = a.seasons.find((s) => s.season === season);
    return { season, score: Math.max(0, Math.min(100, Math.round(found?.score ?? 0))), note: found?.note?.slice(0, 160) ?? "" };
  });
  const extra: ColorExtra = {
    seasons,
    primary: a.primary,
    secondary: a.hasSecondary && a.secondary.season !== a.primary.season ? a.secondary : null,
    characteristics: a.characteristics,
    explanation: a.explanation,
    groups: { clothing: clean(a.clothing, 10), neutrals: clean(a.neutrals, 6), accents: clean(a.accents, 6), lessHarmonious: clean(a.lessHarmonious, 6) },
  };
  return {
    headline: a.headline.slice(0, 80),
    summary: a.summary.slice(0, 600),
    keywords: a.keywords.slice(0, 6).map((k) => k.slice(0, 30)),
    palette: [...extra.groups.clothing.slice(0, 5), ...extra.groups.accents.slice(0, 3)],
    sections: [
      { title: "Why this season", body: a.explanation.slice(0, 800) },
      { title: "How to wear it", body: a.howToWear.slice(0, 600) },
    ],
    confidence: a.confidence,
    limits: a.limits.slice(0, 300),
    extra,
  };
}

const PRACTICE_COLOR: ColorAnswer = {
  photoUsable: true,
  photoIssue: "",
  seasons: [
    { season: "spring", score: 62, note: "Practice: the warmth suits you; the brightest shades may be strong." },
    { season: "summer", score: 38, note: "Practice: cool, powdery shades can look a little flat." },
    { season: "autumn", score: 84, note: "Practice: warm, muted, earthy shades harmonize best." },
    { season: "winter", score: 30, note: "Practice: icy and stark contrasts may feel sharp." },
  ],
  primary: { season: "autumn", subtype: "Soft Autumn" },
  hasSecondary: true,
  secondary: { season: "spring", subtype: "Warm Spring" },
  characteristics: { undertone: "Warm, golden", value: "Medium", chroma: "Soft", contrast: "Medium" },
  headline: "Soft, warm and quietly golden",
  summary: "Practice report: no photo was read. With the real analysis, this explains your coloring and which season suits you best.",
  explanation: "Practice text. The real analysis explains what in your skin, hair and eyes points to the recommended season.",
  keywords: ["Earthy", "Muted", "Golden", "Natural", "Warm"],
  clothing: [
    { name: "Camel", hex: "#C19A6B", note: "" },
    { name: "Terracotta", hex: "#C8603F", note: "" },
    { name: "Olive", hex: "#708238", note: "" },
    { name: "Teal", hex: "#0F7C7C", note: "" },
    { name: "Rust", hex: "#B7410E", note: "" },
    { name: "Moss", hex: "#8A9A5B", note: "" },
    { name: "Warm plum", hex: "#6E3B4E", note: "" },
    { name: "Tobacco", hex: "#7B5B3A", note: "" },
  ],
  neutrals: [
    { name: "Cream", hex: "#F3EBD3", note: "" },
    { name: "Taupe", hex: "#8B7D6B", note: "" },
    { name: "Chocolate", hex: "#5C3A21", note: "" },
    { name: "Warm grey", hex: "#8F8A84", note: "" },
  ],
  accents: [
    { name: "Mustard", hex: "#D9A404", note: "" },
    { name: "Coral", hex: "#F27B5B", note: "" },
    { name: "Burnt orange", hex: "#CC5500", note: "" },
    { name: "Jade", hex: "#00A86B", note: "" },
  ],
  lessHarmonious: [
    { name: "Icy blue", hex: "#D6E6F2", note: "" },
    { name: "Fuchsia", hex: "#D1349B", note: "" },
    { name: "Pure black", hex: "#0B0B0B", note: "" },
    { name: "Optic white", hex: "#FAFAFA", note: "" },
  ],
  howToWear: "Practice text. Practical advice on where to place colors and how to combine them.",
  confidence: "medium",
  limits: "Practice data: no photo was read.",
};

/** Seasonal Color Analysis of the portrait. */
export async function analyzeColor(portrait: { bytes: Uint8Array; mediaType: string }): Promise<Analysis> {
  if (inPracticeMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { data: colorReport(PRACTICE_COLOR), practice: true };
  }

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: COLOR_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: portrait.mediaType as "image/jpeg", data: Buffer.from(portrait.bytes).toString("base64") },
          },
          {
            type: "text",
            text: [
              RESPECT,
              "",
              "Make a personal seasonal color analysis from this portrait. Score all four seasons (Spring, Summer, Autumn,",
              "Winter) for harmony, choose the primary season and subtype and a secondary one only if it genuinely fits,",
              "describe their undertone, value, chroma and contrast, and build their palette with real, specific color",
              "names and accurate HEX codes. Keywords describe the palette's aesthetic, never the person's character.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const answer = JSON.parse(firstText(message)) as ColorAnswer;
  if (!answer.photoUsable) throw new PortraitUnusableError(answer.photoIssue || "Your face isn't clear enough in this portrait. Try a front-facing photo in daylight.");
  const { input_tokens, output_tokens } = message.usage;
  return { data: colorReport(answer), practice: false, inputTokens: input_tokens, outputTokens: output_tokens, costMicros: costMicros(input_tokens, output_tokens) };
}

/* ---------- Personal Style Guide ---------- */

const STYLE_SCHEMA = {
  type: "object",
  properties: {
    photoUsable: { type: "boolean", description: "False if no face is clearly visible" },
    photoIssue: { type: "string", description: "When not usable: what to change, kindly (else empty)" },
    headline: { type: "string", description: "A short editorial headline for their style direction, 3-6 words" },
    summary: { type: "string", description: "Two or three sentences: the recommended direction and why" },
    keywords: { type: "array", items: { type: "string" }, description: "4 to 6 aesthetic keywords (not personality)" },
    directions: {
      type: "array",
      description: "2 to 4 style directions (e.g. Minimalist, Classic, Elegant, Casual chic, Modern, Romantic, Streetwear, Contemporary), best first",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          why: { type: "string", description: "One or two sentences, based on their coloring, the photo's styling and their closet, never on assumed personality" },
          keywords: { type: "array", items: { type: "string" }, description: "3 keywords" },
        },
        required: ["name", "why", "keywords"],
        additionalProperties: false,
      },
    },
    topRecommended: { type: "array", items: swatchSchema, description: "3 top colors that harmonize best with their visible coloring" },
    topNeutral: { type: "array", items: swatchSchema, description: "2 neutral top colors" },
    topLessHarmonious: { type: "array", items: swatchSchema, description: "2 top colors that may create less harmony" },
    colorNotes: { type: "string", description: "Two sentences on how these colors interact with their skin, hair and eyes" },
    jewelry: {
      type: "array",
      description: "Every one of: pearl, jade, ruby, sapphire, diamond, gold, silver, rose_gold, each rated",
      items: {
        type: "object",
        properties: {
          material: { type: "string", enum: ["pearl", "jade", "ruby", "sapphire", "diamond", "gold", "silver", "rose_gold"] },
          rating: { type: "string", enum: ["recommended", "alternative", "less"] },
          why: { type: "string", description: "One short sentence on the material's color and finish with their coloring and direction" },
        },
        required: ["material", "rating", "why"],
        additionalProperties: false,
      },
    },
    jewelryDirection: { type: "string", description: "One or two sentences: metals, stones and scale" },
    colorFamilies: { type: "string", description: "One sentence: the clothing color families to build on" },
    aesthetic: { type: "string", description: "One sentence: the overall aesthetic" },
    wardrobe: { type: "string", description: "Two sentences: the wardrobe styling direction (key pieces, silhouettes, textures)" },
    look: { type: "object", properties: LOOK_PROPERTIES, required: ["pieces", "rationale"], additionalProperties: false },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    limits: { type: "string", description: "What may have affected the reading (lighting, filters, makeup), or empty" },
  },
  required: [
    "photoUsable",
    "photoIssue",
    "headline",
    "summary",
    "keywords",
    "directions",
    "topRecommended",
    "topNeutral",
    "topLessHarmonious",
    "colorNotes",
    "jewelry",
    "jewelryDirection",
    "colorFamilies",
    "aesthetic",
    "wardrobe",
    "look",
    "confidence",
    "limits",
  ],
  additionalProperties: false,
};

type StyleAnswer = {
  photoUsable: boolean;
  photoIssue: string;
  headline: string;
  summary: string;
  keywords: string[];
  directions: { name: string; why: string; keywords: string[] }[];
  topRecommended: NotedSwatch[];
  topNeutral: NotedSwatch[];
  topLessHarmonious: NotedSwatch[];
  colorNotes: string;
  jewelry: { material: Jewelry; rating: JewelryRating; why: string }[];
  jewelryDirection: string;
  colorFamilies: string;
  aesthetic: string;
  wardrobe: string;
  look: { pieces: StyledPiece[]; rationale: string };
  confidence: "high" | "medium" | "low";
  limits: string;
};

function styleReport(a: StyleAnswer, look: StyledLook | null): StudioReportData {
  const extra: StyleExtra = {
    directions: a.directions.slice(0, 4).map((d, i) => ({ name: d.name.slice(0, 30), primary: i === 0, why: d.why.slice(0, 300), keywords: d.keywords.slice(0, 3) })),
    topColors: { recommended: clean(a.topRecommended, 3), neutral: clean(a.topNeutral, 2), lessHarmonious: clean(a.topLessHarmonious, 2) },
    colorNotes: a.colorNotes.slice(0, 400),
    // Every material once, in a fixed order.
    jewelry: JEWELRY.flatMap((material) => {
      const found = a.jewelry.find((j) => j.material === material);
      return found ? [{ material, rating: found.rating, why: found.why.slice(0, 200) }] : [];
    }),
    jewelryDirection: a.jewelryDirection.slice(0, 300),
    overall: { colorFamilies: a.colorFamilies.slice(0, 300), aesthetic: a.aesthetic.slice(0, 300), wardrobe: a.wardrobe.slice(0, 500) },
    look,
  };
  return {
    headline: a.headline.slice(0, 80),
    summary: a.summary.slice(0, 600),
    keywords: a.keywords.slice(0, 6).map((k) => k.slice(0, 30)),
    palette: [...extra.topColors.recommended, ...extra.topColors.neutral],
    sections: [
      { title: "Color families", body: extra.overall.colorFamilies },
      { title: "Wardrobe direction", body: extra.overall.wardrobe },
    ],
    confidence: a.confidence,
    limits: a.limits.slice(0, 300),
    extra,
  };
}

const PRACTICE_STYLE: StyleAnswer = {
  photoUsable: true,
  photoIssue: "",
  headline: "Modern classic, softly refined",
  summary: "Practice report: no photo was read. With the real guide, this explains the style direction that suits your coloring and your closet.",
  keywords: ["Minimal", "Refined", "Warm neutrals", "Clean lines"],
  directions: [
    { name: "Modern classic", why: "Practice text: why this direction suits you.", keywords: ["Tailored", "Timeless", "Clean"] },
    { name: "Casual chic", why: "Practice text: a relaxed second direction.", keywords: ["Easy", "Polished", "Soft"] },
    { name: "Minimalist", why: "Practice text: a pared-back option.", keywords: ["Simple", "Neutral", "Quiet"] },
  ],
  topRecommended: [
    { name: "Camel", hex: "#C19A6B", note: "Practice" },
    { name: "Deep teal", hex: "#0F7C7C", note: "Practice" },
    { name: "Terracotta", hex: "#C8603F", note: "Practice" },
  ],
  topNeutral: [
    { name: "Cream", hex: "#F3EBD3", note: "Practice" },
    { name: "Taupe", hex: "#8B7D6B", note: "Practice" },
  ],
  topLessHarmonious: [
    { name: "Icy blue", hex: "#D6E6F2", note: "Practice" },
    { name: "Fuchsia", hex: "#D1349B", note: "Practice" },
  ],
  colorNotes: "Practice text: how these colors interact with your skin, hair and eyes.",
  jewelry: [
    { material: "pearl", rating: "recommended", why: "Practice text." },
    { material: "gold", rating: "recommended", why: "Practice text." },
    { material: "jade", rating: "alternative", why: "Practice text." },
    { material: "rose_gold", rating: "alternative", why: "Practice text." },
    { material: "ruby", rating: "alternative", why: "Practice text." },
    { material: "sapphire", rating: "less", why: "Practice text." },
    { material: "diamond", rating: "alternative", why: "Practice text." },
    { material: "silver", rating: "less", why: "Practice text." },
  ],
  jewelryDirection: "Practice text: metals, stones and scale.",
  colorFamilies: "Practice text: the color families to build on.",
  aesthetic: "Practice text: the overall aesthetic.",
  wardrobe: "Practice text: key pieces, silhouettes and textures.",
  look: { pieces: [], rationale: "" },
  confidence: "medium",
  limits: "Practice data: no photo was read.",
};

/** Personal Style Guide of the portrait, with a look from the person's closet when they have one. */
export async function analyzeStyle(portrait: { bytes: Uint8Array; mediaType: string }, closet: ClothingItem[]): Promise<Analysis> {
  if (inPracticeMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { data: styleReport(PRACTICE_STYLE, closet.length >= 2 ? practiceLook(closet, null) : null), practice: true };
  }

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 10000,
    output_config: { format: { type: "json_schema", schema: STYLE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: portrait.mediaType as "image/jpeg", data: Buffer.from(portrait.bytes).toString("base64") },
          },
          {
            type: "text",
            text: [
              RESPECT,
              "Never assume personality traits from appearance. Base style directions on their visible coloring, how they",
              "are styled in the photo, and the clothes they already own (their closet shows their preferences).",
              "",
              "Write a personal style guide: style directions, top colors compared (recommended, neutral, less harmonious,",
              "with accurate HEX codes), every jewelry material rated (recommended, alternative or less preferred) with why,",
              "and an overall summary.",
              "",
              closet.length >= 2 ? LOOK_RULES : "Their closet has fewer than two pieces: return an empty pieces list and an empty rationale.",
              "",
              "Their closet, as JSON:",
              JSON.stringify(inventoryOf(closet)),
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const answer = JSON.parse(firstText(message)) as StyleAnswer;
  if (!answer.photoUsable) throw new PortraitUnusableError(answer.photoIssue || "Your face isn't clear enough in this portrait. Try a front-facing photo in daylight.");
  const look = closet.length >= 2 ? cleanLook(answer.look, closet, null) : null;
  const { input_tokens, output_tokens } = message.usage;
  return { data: styleReport(answer, look), practice: false, inputTokens: input_tokens, outputTokens: output_tokens, costMicros: costMicros(input_tokens, output_tokens) };
}

/* ---------- Personal Makeup Guide ---------- */

const MAKEUP_SCHEMA = {
  type: "object",
  properties: {
    photoUsable: { type: "boolean", description: "False if the face isn't clearly visible" },
    photoIssue: { type: "string", description: "When not usable: what to change, kindly (else empty)" },
    headline: { type: "string", description: "A short editorial headline for their makeup direction, 3-6 words" },
    summary: { type: "string", description: "Two or three sentences: the recommended overall look and why" },
    keywords: { type: "array", items: { type: "string" }, description: "4 to 6 makeup aesthetic keywords" },
    features: {
      type: "object",
      description: "Neutral, respectful observations of what is visible; never a flaw, never something to fix",
      properties: {
        eyes: { type: "string", description: "Eye shape and appearance, one sentence" },
        brows: { type: "string", description: "Natural brow shape, one sentence" },
        lips: { type: "string", description: "Lip shape and natural lip color, one sentence" },
        proportions: { type: "string", description: "Overall facial proportions, one neutral sentence" },
        undertone: { type: "string", description: "Visible skin undertone where reasonably assessable, one sentence" },
      },
      required: ["eyes", "brows", "lips", "proportions", "undertone"],
      additionalProperties: false,
    },
    recommendations: {
      type: "object",
      properties: {
        brows: { type: "string" },
        eyes: { type: "string" },
        eyeliner: { type: "string" },
        blush: { type: "string", description: "Shade family and placement" },
        lips: { type: "string" },
        base: { type: "string", description: "Base makeup and finish (e.g. satin, dewy, matte)" },
      },
      required: ["brows", "eyes", "eyeliner", "blush", "lips", "base"],
      additionalProperties: false,
    },
    styles: {
      type: "array",
      description: "3 to 5 makeup styles that suit them (e.g. Clean girl, Soft glam, Natural, Korean-inspired, Classic, Editorial), best first",
      items: {
        type: "object",
        properties: { name: { type: "string" }, why: { type: "string", description: "One or two sentences" } },
        required: ["name", "why"],
        additionalProperties: false,
      },
    },
    eyeshadow: { type: "array", items: swatchSchema, description: "4 eyeshadow shades" },
    blush: { type: "array", items: swatchSchema, description: "3 blush shades" },
    lipstick: { type: "array", items: swatchSchema, description: "4 lip shades, from everyday to evening" },
    brow: { type: "array", items: swatchSchema, description: "2 brow product shades" },
    direction: { type: "string", description: "Two or three sentences: the personalized overall makeup direction" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    limits: { type: "string", description: "What may have affected the reading (lighting, existing makeup, filters), or empty" },
  },
  required: [
    "photoUsable",
    "photoIssue",
    "headline",
    "summary",
    "keywords",
    "features",
    "recommendations",
    "styles",
    "eyeshadow",
    "blush",
    "lipstick",
    "brow",
    "direction",
    "confidence",
    "limits",
  ],
  additionalProperties: false,
};

type MakeupAnswer = {
  photoUsable: boolean;
  photoIssue: string;
  headline: string;
  summary: string;
  keywords: string[];
  features: MakeupExtra["features"];
  recommendations: MakeupExtra["recommendations"];
  styles: { name: string; why: string }[];
  eyeshadow: NotedSwatch[];
  blush: NotedSwatch[];
  lipstick: NotedSwatch[];
  brow: NotedSwatch[];
  direction: string;
  confidence: "high" | "medium" | "low";
  limits: string;
};

const short = (v: string, max = 300) => v.slice(0, max);

function makeupReport(a: MakeupAnswer): StudioReportData {
  const extra: MakeupExtra = {
    features: { eyes: short(a.features.eyes), brows: short(a.features.brows), lips: short(a.features.lips), proportions: short(a.features.proportions), undertone: short(a.features.undertone) },
    recommendations: {
      brows: short(a.recommendations.brows, 400),
      eyes: short(a.recommendations.eyes, 400),
      eyeliner: short(a.recommendations.eyeliner, 400),
      blush: short(a.recommendations.blush, 400),
      lips: short(a.recommendations.lips, 400),
      base: short(a.recommendations.base, 400),
    },
    styles: a.styles.slice(0, 5).map((s, i) => ({ name: s.name.slice(0, 30), best: i === 0, why: short(s.why) })),
    shades: { eyeshadow: clean(a.eyeshadow, 5), blush: clean(a.blush, 4), lipstick: clean(a.lipstick, 5), brow: clean(a.brow, 3) },
    direction: short(a.direction, 600),
  };
  return {
    headline: a.headline.slice(0, 80),
    summary: a.summary.slice(0, 600),
    keywords: a.keywords.slice(0, 6).map((k) => k.slice(0, 30)),
    palette: [...extra.shades.lipstick.slice(0, 3), ...extra.shades.blush.slice(0, 2), ...extra.shades.eyeshadow.slice(0, 3)],
    sections: [{ title: "Your makeup direction", body: extra.direction }],
    confidence: a.confidence,
    limits: a.limits.slice(0, 300),
    extra,
  };
}

const PRACTICE_MAKEUP: MakeupAnswer = {
  photoUsable: true,
  photoIssue: "",
  headline: "Fresh, rosy and softly defined",
  summary: "Practice report: no photo was read. With the real guide, this explains the overall makeup look that suits your features.",
  keywords: ["Soft", "Rosy", "Luminous", "Natural"],
  features: {
    eyes: "Practice text: your eye shape, described neutrally.",
    brows: "Practice text: your natural brow shape.",
    lips: "Practice text: your lip shape and natural lip color.",
    proportions: "Practice text: your facial proportions, described neutrally.",
    undertone: "Practice text: your visible undertone.",
  },
  recommendations: {
    brows: "Practice text.",
    eyes: "Practice text.",
    eyeliner: "Practice text.",
    blush: "Practice text.",
    lips: "Practice text.",
    base: "Practice text.",
  },
  styles: [
    { name: "Soft glam", why: "Practice text." },
    { name: "Natural", why: "Practice text." },
    { name: "Korean-inspired", why: "Practice text." },
  ],
  eyeshadow: [
    { name: "Champagne", hex: "#E8CFA9", note: "Practice" },
    { name: "Soft taupe", hex: "#9C8573", note: "Practice" },
    { name: "Bronze", hex: "#9A6A3E", note: "Practice" },
    { name: "Plum smoke", hex: "#6A4A5A", note: "Practice" },
  ],
  blush: [
    { name: "Peach", hex: "#F0A98C", note: "Practice" },
    { name: "Soft rose", hex: "#D99A9A", note: "Practice" },
    { name: "Apricot", hex: "#E89A6E", note: "Practice" },
  ],
  lipstick: [
    { name: "Rosewood", hex: "#A8636B", note: "Practice" },
    { name: "Coral nude", hex: "#D27D6B", note: "Practice" },
    { name: "Brick", hex: "#9B3A2E", note: "Practice" },
    { name: "Berry", hex: "#8E3A59", note: "Practice" },
  ],
  brow: [
    { name: "Soft brown", hex: "#6B5444", note: "Practice" },
    { name: "Ash brown", hex: "#5B5048", note: "Practice" },
  ],
  direction: "Practice text: your personalized overall makeup direction.",
  confidence: "medium",
  limits: "Practice data: no photo was read.",
};

/** Personal Makeup Guide of the portrait. */
export async function analyzeMakeup(portrait: { bytes: Uint8Array; mediaType: string }): Promise<Analysis> {
  if (inPracticeMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { data: makeupReport(PRACTICE_MAKEUP), practice: true };
  }

  const message = await anthropic.messages.create({
    model: OUTFIT_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: MAKEUP_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: portrait.mediaType as "image/jpeg", data: Buffer.from(portrait.bytes).toString("base64") },
          },
          {
            type: "text",
            text: [
              RESPECT,
              "You are writing as a makeup artist. Describe features neutrally and never as something to correct, hide,",
              "slim or make smaller; makeup here is about enhancing and expressing, not changing anyone's natural look.",
              "",
              "Write a personal makeup guide from this portrait: feature observations, recommendations for brows, eyes,",
              "eyeliner, blush, lips and base, makeup styles that suit them and why, and real product-style shade names",
              "with accurate HEX codes for eyeshadow, blush, lipstick and brows.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const answer = JSON.parse(firstText(message)) as MakeupAnswer;
  if (!answer.photoUsable) throw new PortraitUnusableError(answer.photoIssue || "Your face isn't clear enough in this portrait. Try a front-facing photo in daylight.");
  const { input_tokens, output_tokens } = message.usage;
  return { data: makeupReport(answer), practice: false, inputTokens: input_tokens, outputTokens: output_tokens, costMicros: costMicros(input_tokens, output_tokens) };
}
