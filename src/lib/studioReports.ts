import { prisma } from "@/lib/prisma";
import { loadPortrait } from "@/lib/portrait";
import { CreditError, withCredit } from "@/lib/credits";
import { PortraitUnusableError, analyzeColor, analyzeHair, analyzeMakeup, analyzeStyle, type Analysis } from "@/lib/studioAnalysis";
import type { StyledLook, StyledPiece } from "@/lib/closetLook";
import { type ReportSummary, type StudioModuleId, type StudioReportData } from "@/lib/studioModules";

/**
 * AI Stylist reports: made one module at a time, only when the person asks, and kept so opening one again is free.
 * A request id makes a repeated tap answer once, and a module that's already being made can't be started again
 * until it finishes (or is clearly stuck).
 *
 * A real analysis uses one photo credit, counted only when a real report comes back (a failure gives it back).
 */

/** Earlier reports kept per module, so people can look back. Older ones are deleted. */
const KEEP_PER_MODULE = 10;
/** A report still "generating" after this long is treated as failed, so the module can be tried again. */
const STUCK_MS = 3 * 60 * 1000;

export class ReportError extends Error {
  constructor(
    public code: "no_portrait" | "unusable" | "no_credits" | "busy" | "failed",
    message: string
  ) {
    super(message);
  }
}


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
export async function generateReport(account: { id: string; role: string }, module: StudioModuleId, requestId: string): Promise<StoredReport> {
  const userId = account.id;
  const repeat = await prisma.studioReport.findUnique({ where: { userId_requestId: { userId, requestId } } });
  if (repeat) {
    const stored = repeat.status === "ready" ? toStored(repeat) : null;
    if (stored) return stored;
    throw new ReportError("busy", "This analysis is already being made. It'll be ready in a moment.");
  }

  const portrait = await loadPortrait(userId);
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
    // One photo credit for a real analysis, counted only when a real report comes back.
    const made = await withCredit(account, "photo", `studio-${requestId}`, () => makeReport(userId, module, portrait), (r) => !r.practice);
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
    if (err instanceof PortraitUnusableError) throw new ReportError("unusable", err.message);
    if (err instanceof CreditError && err.code === "no_credits") throw new ReportError("no_credits", "You've used this month's photo credits.");
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


async function makeReport(userId: string, module: StudioModuleId, portrait: { bytes: Uint8Array; mediaType: string }): Promise<Analysis> {
  if (module === "color") return analyzeColor(portrait);
  if (module === "makeup") return analyzeMakeup(portrait);
  if (module === "hair") return analyzeHair(portrait);
  const closet = await prisma.clothingItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return analyzeStyle(portrait, closet);
}

/**
 * Saves the Style report's closet look after a piece is swapped or taken out. The page sends the look as it now
 * stands; only this person's own pieces are kept, and alternates must be the same kind.
 */
export async function updateStyleLook(userId: string, id: string, sent: unknown[]): Promise<StoredReport | null> {
  const row = await prisma.studioReport.findFirst({ where: { id, userId, module: "style", status: "ready" } });
  const data = row ? parse(row.data) : null;
  const extra = data?.extra as { look?: StyledLook | null } | undefined;
  if (!row || !data || !extra?.look) return null;

  const pieces = sent.slice(0, 8).filter((p): p is StyledPiece => typeof (p as StyledPiece)?.itemId === "string" && Array.isArray((p as StyledPiece)?.alternates));
  const ids = [...new Set(pieces.flatMap((p) => [p.itemId, ...p.alternates]))].filter((v) => typeof v === "string");
  const owned = await prisma.clothingItem.findMany({ where: { userId, id: { in: ids } }, select: { id: true, category: true } });
  const category = new Map(owned.map((i) => [i.id, i.category]));
  const look: StyledLook = {
    ...extra.look,
    pieces: pieces
      .filter((p) => category.has(p.itemId))
      .map((p) => ({
        itemId: p.itemId,
        why: typeof p.why === "string" ? p.why.slice(0, 240) : "",
        alternates: [...new Set(p.alternates)].filter((a) => a !== p.itemId && category.get(a) === category.get(p.itemId)).slice(0, 4),
      })),
  };
  const updated = await prisma.studioReport.update({ where: { id }, data: { data: JSON.stringify({ ...data, extra: { ...extra, look } }) } });
  return toStored(updated);
}
