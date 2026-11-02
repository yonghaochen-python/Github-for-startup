/**
 * Virm Studio's four analyses, shared by the pages and the server. Each one is generated on its own, only when the
 * person asks, and kept so it can be opened again for free.
 */

export const STUDIO_MODULE_IDS = ["color", "makeup", "hair", "style"] as const;
export type StudioModuleId = (typeof STUDIO_MODULE_IDS)[number];

export const isStudioModule = (v: unknown): v is StudioModuleId => (STUDIO_MODULE_IDS as readonly unknown[]).includes(v);

export type StudioModule = {
  id: StudioModuleId;
  /** Small label above titles ("Color"). */
  label: string;
  title: string;
  description: string;
  /** What the report covers, shown before the first analysis. */
  covers: string[];
  /** The module's own look inside Virm's palette: page tint, accent, and the tones its thumbnail shows. */
  tint: string;
  accent: string;
  tones: string[];
};

export const STUDIO_MODULES: StudioModule[] = [
  {
    id: "color",
    label: "Color",
    title: "Seasonal Color Analysis",
    description: "How you match each season, and the palette that brings out your own coloring.",
    covers: ["Your match with Spring, Summer, Autumn and Winter", "Main and second season, with how sure it is", "Clothing, neutral and accent colors with HEX codes", "Aesthetic keywords for your palette"],
    tint: "#f7f1ea",
    accent: "#a5573c",
    tones: ["#e8b49a", "#c98a5e", "#8f5a3c", "#d9c2a7", "#6f7d5c"],
  },
  {
    id: "makeup",
    label: "Makeup",
    title: "Personal Makeup Guide",
    description: "Brows, eyes, blush, lips and base in the shades and finishes that suit your features.",
    covers: ["Respectful notes on your features and undertone", "Brows, eyes, liner, blush, lips and base", "Makeup styles that suit you, and why", "Eyeshadow, blush, lipstick and brow shades"],
    tint: "#f8eff0",
    accent: "#a34a5c",
    tones: ["#e9b7b3", "#c97b7e", "#9c4155", "#d8a48f", "#7b5a4f"],
  },
  {
    id: "hair",
    label: "Hair",
    title: "Hair & Color Guide",
    description: "Lengths, textures, bangs and partings compared, and the hair colors that suit you.",
    covers: ["Short, medium and long; straight, wavy and curly", "Bangs, partings, layered and blunt cuts", "Recommended, alternative and less preferred", "Hair color families with swatches"],
    tint: "#f1efec",
    accent: "#5b4636",
    tones: ["#2b2420", "#4a3426", "#6e4b33", "#8a6a52", "#5a2630"],
  },
  {
    id: "style",
    label: "Style",
    title: "Personal Style Guide",
    description: "Your style direction, the top colors that suit you side by side, and your jewelry metals and stones.",
    covers: ["Style directions and aesthetic keywords", "Top colors compared on your own photo", "Pearls, jade, gold, silver and more", "Your wardrobe direction in one summary"],
    tint: "#eff1f3",
    accent: "#2f3a45",
    tones: ["#1f2a36", "#7c8794", "#c9b28a", "#e9e4da", "#8c2f39"],
  },
];

export const studioModule = (id: StudioModuleId) => STUDIO_MODULES.find((m) => m.id === id)!;

export type Swatch = { name: string; hex: string };

/**
 * What every report has. Each module adds its own parts (season scores, makeup shades, hair comparisons...) in
 * `extra`, filled in as the modules are built.
 */
export type StudioReportData = {
  headline: string;
  summary: string;
  keywords: string[];
  palette: Swatch[];
  sections: { title: string; body: string }[];
  /** How sure the analysis is, and what limited it (lighting, photo quality). */
  confidence: "high" | "medium" | "low";
  limits: string;
  extra?: Record<string, unknown>;
};

export type ReportSummary = { id: string; createdAt: string; practice: boolean };

/** The portrait's quality checks, made on the device before it's saved. */
export type PortraitChecks = {
  width: number;
  height: number;
  /** Average brightness, 0–255. */
  brightness: number;
  /** A face was found, and it's large enough to read. */
  face: "clear" | "small" | "none" | "unknown";
};

export type PortraitInfo = { version: string; checks: PortraitChecks | null };

/** Whether a portrait is good enough to analyze, and if not, what to change. */
export function portraitReadiness(checks: PortraitChecks | null): { ready: boolean; note: string } {
  if (!checks) return { ready: true, note: "Ready for analysis" };
  if (Math.min(checks.width, checks.height) < 500) return { ready: false, note: "This photo is quite small. A sharper one gives better results." };
  if (checks.brightness < 60) return { ready: false, note: "This photo is quite dark. Try daylight, facing a window." };
  if (checks.brightness > 225) return { ready: false, note: "This photo is very bright. Try softer light." };
  if (checks.face === "none") return { ready: false, note: "We couldn't find a face. Try a front-facing photo." };
  if (checks.face === "small") return { ready: false, note: "Your face is small in this photo. A head-and-shoulders photo works best." };
  return { ready: true, note: "Ready for analysis" };
}
