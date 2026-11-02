import { anthropic, OUTFIT_MODEL, firstText } from "@/lib/anthropic";
import { isDevMode } from "@/lib/auth";
import { SEASONS, isHex, type ColorExtra, type NotedSwatch, type Season } from "@/lib/studioColor";
import type { StudioReportData } from "@/lib/studioModules";

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
