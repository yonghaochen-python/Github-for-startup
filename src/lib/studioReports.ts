import { prisma } from "@/lib/prisma";
import { portraitInfo } from "@/lib/portrait";
import { type ReportSummary, type StudioModuleId, type StudioReportData } from "@/lib/studioModules";

/**
 * Virm Studio reports: made one module at a time, only when the person asks, and kept so opening one again is free.
 * A request id makes a repeated tap answer once, and a module that's already being made can't be started again
 * until it finishes (or is clearly stuck).
 *
 * Stage 1: every module returns practice data (no AI, no cost). The real analyses replace `makeReport` one module
 * at a time.
 */

/** Earlier reports kept per module, so people can look back. Older ones are deleted. */
const KEEP_PER_MODULE = 10;
/** A report still "generating" after this long is treated as failed, so the module can be tried again. */
const STUCK_MS = 3 * 60 * 1000;

export class ReportError extends Error {
  constructor(
    public code: "no_portrait" | "busy" | "failed",
    message: string
  ) {
    super(message);
  }
}

type Made = { data: StudioReportData; practice: boolean; inputTokens?: number; outputTokens?: number; costMicros?: number };

const parse = (json: string | null): StudioReportData | null => {
  try {
    return json ? (JSON.parse(json) as StudioReportData) : null;
  } catch {
    return null;
  }
};

export type StoredReport = { id: string; module: StudioModuleId; data: StudioReportData; practice: boolean; createdAt: string; portraitVersion: string | null };

function toStored(row: { id: string; module: string; data: string | null; practice: boolean; createdAt: Date; portraitVersion: string | null }): StoredReport | null {
  const data = parse(row.data);
  return data ? { id: row.id, module: row.module as StudioModuleId, data, practice: row.practice, createdAt: row.createdAt.toISOString(), portraitVersion: row.portraitVersion } : null;
}

/** The newest finished report of each module (for the Studio home). */
export async function latestReports(userId: string): Promise<Partial<Record<StudioModuleId, ReportSummary>>> {
  const rows = await prisma.studioReport.findMany({
    where: { userId, status: "ready" },
    orderBy: { createdAt: "desc" },
    select: { id: true, module: true, createdAt: true, practice: true },
  });
  const out: Partial<Record<StudioModuleId, ReportSummary>> = {};
  for (const r of rows) {
    const m = r.module as StudioModuleId;
    if (!out[m]) out[m] = { id: r.id, createdAt: r.createdAt.toISOString(), practice: r.practice };
  }
  return out;
}

/** One module's report (the newest, or the one asked for) and its history. */
export async function moduleReports(userId: string, module: StudioModuleId, id?: string) {
  const rows = await prisma.studioReport.findMany({
    where: { userId, module, status: "ready" },
    orderBy: { createdAt: "desc" },
    take: KEEP_PER_MODULE,
  });
  const chosen = (id ? rows.find((r) => r.id === id) : rows[0]) ?? null;
  const generating = await prisma.studioReport.findFirst({
    where: { userId, module, status: "generating", createdAt: { gt: new Date(Date.now() - STUCK_MS) } },
    select: { id: true },
  });
  return {
    report: chosen ? toStored(chosen) : null,
    history: rows.map((r): ReportSummary => ({ id: r.id, createdAt: r.createdAt.toISOString(), practice: r.practice })),
    generating: Boolean(generating),
  };
}

/** Makes a new report for one module. A repeat of the same request returns the same report instead of a new one. */
export async function generateReport(userId: string, module: StudioModuleId, requestId: string): Promise<StoredReport> {
  const repeat = await prisma.studioReport.findUnique({ where: { userId_requestId: { userId, requestId } } });
  if (repeat) {
    const stored = repeat.status === "ready" ? toStored(repeat) : null;
    if (stored) return stored;
    throw new ReportError("busy", "This analysis is already being made. It'll be ready in a moment.");
  }

  const portrait = await portraitInfo(userId);
  if (!portrait) throw new ReportError("no_portrait", "Add your portrait first.");

  // Clear anything stuck, then make sure this module isn't already being made.
  await prisma.studioReport.updateMany({
    where: { userId, module, status: "generating", createdAt: { lt: new Date(Date.now() - STUCK_MS) } },
    data: { status: "failed", finishedAt: new Date() },
  });
  const busy = await prisma.studioReport.findFirst({ where: { userId, module, status: "generating" }, select: { id: true } });
  if (busy) throw new ReportError("busy", "This analysis is already being made. It'll be ready in a moment.");

  const row = await prisma.studioReport
    .create({ data: { userId, module, status: "generating", requestId, portraitVersion: portrait.version } })
    .catch(() => null);
  if (!row) throw new ReportError("busy", "This analysis is already being made. It'll be ready in a moment.");

  try {
    const made = await makeReport(module);
    const done = await prisma.studioReport.update({
      where: { id: row.id },
      data: {
        status: "ready",
        data: JSON.stringify(made.data),
        practice: made.practice,
        inputTokens: made.inputTokens ?? null,
        outputTokens: made.outputTokens ?? null,
        costMicros: made.costMicros ?? null,
        finishedAt: new Date(),
      },
    });
    await pruneHistory(userId, module);
    return toStored(done)!;
  } catch (err) {
    await prisma.studioReport.update({ where: { id: row.id }, data: { status: "failed", finishedAt: new Date() } }).catch(() => {});
    if (err instanceof ReportError) throw err;
    console.error(`Studio ${module} report failed:`, err instanceof Error ? err.message : "unknown");
    throw new ReportError("failed", "This analysis couldn't be made right now. Please try again in a moment.");
  }
}

async function pruneHistory(userId: string, module: StudioModuleId) {
  const old = await prisma.studioReport.findMany({
    where: { userId, module },
    orderBy: { createdAt: "desc" },
    skip: KEEP_PER_MODULE,
    select: { id: true },
  });
  if (old.length) await prisma.studioReport.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
}

export async function deleteReport(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.studioReport.deleteMany({ where: { userId, id } });
  return count === 1;
}


/* ---------- Practice data (Stage 1: no AI, no cost) ---------- */

const PRACTICE: Record<StudioModuleId, StudioReportData> = {
  color: {
    headline: "Soft, warm and quietly golden",
    summary: "Practice report. The real analysis reads your skin, hair and eye coloring from your portrait and explains which season suits you best.",
    keywords: ["Warm", "Muted", "Earthy", "Gentle contrast"],
    palette: [
      { name: "Camel", hex: "#C19A6B" },
      { name: "Terracotta", hex: "#C8603F" },
      { name: "Olive", hex: "#708238" },
      { name: "Cream", hex: "#F3EBD3" },
      { name: "Teal", hex: "#0F7C7C" },
      { name: "Chocolate", hex: "#5C3A21" },
    ],
    sections: [
      { title: "Why this season", body: "Practice text. Here you'll read what in your coloring points to the recommended season." },
      { title: "Colors to wear near your face", body: "Practice text. Clothing, neutral and accent colors, each with its HEX code." },
    ],
    confidence: "medium",
    limits: "Practice data: no photo was read.",
  },
  makeup: {
    headline: "Fresh, rosy and softly defined",
    summary: "Practice report. The real guide describes your features respectfully and suggests shades and finishes that suit them.",
    keywords: ["Soft glam", "Natural", "Rosy"],
    palette: [
      { name: "Soft rose", hex: "#D99A9A" },
      { name: "Peach blush", hex: "#F0A98C" },
      { name: "Taupe shadow", hex: "#8B7D6B" },
      { name: "Berry lip", hex: "#8E3A59" },
      { name: "Ash brow", hex: "#6B5B4E" },
    ],
    sections: [
      { title: "Your features", body: "Practice text. Eye, brow and lip shape, described without judgment." },
      { title: "How to wear it", body: "Practice text. Brows, eyes, liner, blush, lips and base." },
    ],
    confidence: "medium",
    limits: "Practice data: no photo was read.",
  },
  hair: {
    headline: "Long layers with soft movement",
    summary: "Practice report. The real guide compares lengths, textures, bangs and colors, and explains how each frames your face.",
    keywords: ["Layered", "Face-framing", "Warm brown"],
    palette: [
      { name: "Natural black", hex: "#1E1A18" },
      { name: "Dark brown", hex: "#3B2A20" },
      { name: "Warm brown", hex: "#6E4B33" },
      { name: "Ash brown", hex: "#6B6157" },
      { name: "Burgundy", hex: "#5A2630" },
    ],
    sections: [
      { title: "Recommended", body: "Practice text. The cuts that suit you best and why." },
      { title: "Hair colors", body: "Practice text. Color families compared with swatches." },
    ],
    confidence: "medium",
    limits: "Practice data: no photo was read.",
  },
  style: {
    headline: "Modern classic, softly refined",
    summary: "Practice report. The real guide suggests style directions, compares top colors on your photo, and covers jewelry.",
    keywords: ["Minimalist", "Classic", "Elegant"],
    palette: [
      { name: "Navy", hex: "#1F2A44" },
      { name: "Ivory", hex: "#F6F1E1" },
      { name: "Camel", hex: "#C19A6B" },
      { name: "Burgundy", hex: "#7A1C2E" },
      { name: "Gold", hex: "#C9A227" },
    ],
    sections: [
      { title: "Your direction", body: "Practice text. Style directions and aesthetic keywords, and why." },
      { title: "Jewelry", body: "Practice text. Pearls, jade, gold, silver and more, compared." },
    ],
    confidence: "medium",
    limits: "Practice data: no photo was read.",
  },
};

async function makeReport(module: StudioModuleId): Promise<Made> {
  // A short pause so the loading state can be seen and tested.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { data: PRACTICE[module], practice: true };
}
