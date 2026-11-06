import { prisma } from "@/lib/prisma";
import { styleProfileFor } from "@/lib/studioReports";
import { profileColors } from "@/lib/styleProfile";
import { neighborMonths, readDays, type PlanDays, type PlanPiece, type PlanTaste } from "@/lib/planOutfits";

/** Server side of the Planner: the person's closet, taste and stored months. No AI is called anywhere here. */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * "Today" in the person's own time zone, sent by their browser; accepted only when it's within a day of the server's
 * date (so a wrong clock can't plan the past).
 */
export function todayFrom(sent: unknown): string {
  const server = new Date();
  const utc = server.toISOString().slice(0, 10);
  if (typeof sent !== "string" || !DATE_RE.test(sent)) return utc;
  const gap = Math.abs(new Date(`${sent}T12:00:00Z`).getTime() - new Date(`${utc}T12:00:00Z`).getTime());
  return gap <= 36 * 60 * 60 * 1000 ? sent : utc;
}

export async function closetFor(userId: string): Promise<PlanPiece[]> {
  const rows = await prisma.clothingItem.findMany({
    where: { userId },
    select: { id: true, imageUrl: true, category: true, description: true, layeringRole: true, color: true, season: true, warmth: true, formality: true },
    orderBy: { createdAt: "desc" },
  });
  return rows as PlanPiece[];
}

export async function tasteFor(userId: string): Promise<PlanTaste> {
  const profile = await styleProfileFor(userId).catch(() => null);
  if (!profile) return { palette: null, style: null };
  const palette = profileColors(profile);
  const style = profile.style ? `${profile.style.direction} ${profile.style.keywords.join(" ")} ${profile.style.aesthetic}` : null;
  return { palette: palette.wear.length ? palette : null, style };
}

export async function readMonth(userId: string, month: string, closetIds?: Set<string>): Promise<PlanDays | null> {
  const row = await prisma.outfitPlan.findUnique({ where: { userId_month: { userId, month } }, select: { days: true } });
  return row ? readDays(row.days, closetIds) : null;
}

/** The days of the months next to this one (for weeks that cross over). */
export async function aroundMonth(userId: string, month: string, closetIds: Set<string>): Promise<PlanDays> {
  const rows = await prisma.outfitPlan.findMany({ where: { userId, month: { in: neighborMonths(month) } }, select: { days: true } });
  return Object.assign({}, ...rows.map((r) => readDays(r.days, closetIds)));
}

export async function saveMonth(userId: string, month: string, days: PlanDays) {
  const json = JSON.stringify(days);
  await prisma.outfitPlan.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, days: json },
    update: { days: json },
  });
}
