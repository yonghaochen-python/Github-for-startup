import { prisma } from "@/lib/prisma";

/**
 * Owner dashboard numbers. Everything is counted from real rows: accounts, closet items, outfits and the
 * AnalyticsEvent table. Nothing here reads photos, clothing details or outfit text, and results are totals
 * and daily counts only. Days are UTC calendar days.
 */

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Every UTC day from `from` to `to`, inclusive, as YYYY-MM-DD. */
function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let t = start; t <= to.getTime(); t += DAY) out.push(dayKey(new Date(t)));
  return out;
}

function countByDay(dates: Date[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const d of dates) {
    const k = dayKey(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return days.map((d) => counts.get(d) ?? 0);
}

const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;

/** Compares the second half of a period with the first half: growing / stable / declining, or not enough data. */
function trend(series: number[]): { label: "growing" | "stable" | "declining" | "not enough data"; change: number | null } {
  if (series.length < 4) return { label: "not enough data", change: null };
  const half = Math.floor(series.length / 2);
  const before = series.slice(0, half).reduce((a, b) => a + b, 0);
  const after = series.slice(series.length - half).reduce((a, b) => a + b, 0);
  if (before + after < 5) return { label: "not enough data", change: null };
  if (before === 0) return { label: "growing", change: null };
  const change = (after - before) / before;
  return { label: change > 0.1 ? "growing" : change < -0.1 ? "declining" : "stable", change };
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/** Masks an email for the account list: "yonghao@gmail.com" -> "y•••@gmail.com". */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain ?? ""}`;
}

const FEATURES = [
  { key: "home", label: "Home" },
  { key: "closet", label: "My Closet" },
  { key: "stylist", label: "AI Stylist" },
  { key: "tryon", label: "Try On" },
  { key: "saved", label: "Saved Looks" },
  { key: "profile", label: "Profile" },
] as const;

export async function computeAdminStats(from: Date, to: Date) {
  const now = new Date();
  const [users, allItems, allOutfits, allEvents, firstEvent] = await Promise.all([
    prisma.user.findMany({ select: { id: true, createdAt: true, lastActiveAt: true, role: true } }),
    prisma.clothingItem.findMany({ select: { userId: true, createdAt: true, imageUrl: true } }),
    prisma.outfit.findMany({ select: { userId: true, createdAt: true, isFavorite: true } }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: new Date(Math.min(from.getTime(), now.getTime() - 30 * DAY)), lte: to } },
      select: { userId: true, name: true, ok: true, durationMs: true, createdAt: true },
    }),
    prisma.analyticsEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const days = daysBetween(from, to);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // The owner's own admin accounts are left out of every number, so testing doesn't inflate the stats.
  const adminIds = new Set(users.filter((u) => u.role === "admin").map((u) => u.id));
  const people = users.filter((u) => !adminIds.has(u.id));
  const items = allItems.filter((i) => !adminIds.has(i.userId));
  const outfits = allOutfits.filter((o) => !adminIds.has(o.userId));
  const events = allEvents.filter((e) => !e.userId || !adminIds.has(e.userId));
  const signups = people.map((u) => u.createdAt);

  // Growth: running total of accounts at the end of each day.
  const newPerDay = countByDay(signups, days);
  const before = signups.filter((d) => d < new Date(`${days[0]}T00:00:00Z`)).length;
  let running = before;
  const totalPerDay = newPerDay.map((n) => (running += n));

  // Uploaded clothes are stored at /uploads/...; starter-closet pieces point at /sample/... and aren't uploads.
  const uploads = items.filter((i) => i.imageUrl.startsWith("/uploads/"));
  const rangeEvents = events.filter((e) => inRange(e.createdAt, from, to));
  const named = (prefix: string) => rangeEvents.filter((e) => e.name === prefix);

  // Active users per day (from recorded events), and in the rolling 7/30-day windows (from last-active dates).
  const activeByDay = days.map((d) => new Set(rangeEvents.filter((e) => e.userId && dayKey(e.createdAt) === d).map((e) => e.userId)).size);
  const activeSince = (ms: number) => people.filter((u) => u.lastActiveAt && now.getTime() - u.lastActiveAt.getTime() <= ms).length;

  // Visits per feature (deduplicated per person per hour when recorded).
  const featureUse = FEATURES.map((f) => ({
    ...f,
    visits: rangeEvents.filter((e) => e.name === `visit_${f.key}`).length,
    people: new Set(rangeEvents.filter((e) => e.name === `visit_${f.key}` && e.userId).map((e) => e.userId)).size,
  }));

  const outcome = (name: string) => {
    const list = named(name);
    const ok = list.filter((e) => e.ok).length;
    const durations = list.filter((e) => e.ok && e.durationMs != null).map((e) => e.durationMs as number);
    return {
      total: list.length,
      ok,
      failed: list.length - ok,
      failureRate: list.length ? (list.length - ok) / list.length : null,
      medianMs: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      perDay: countByDay(list.map((e) => e.createdAt), days),
    };
  };

  // Retention: of the people who signed up at least 7 days ago, how many were active again 1+ days after signing up.
  const matured = people.filter((u) => now.getTime() - u.createdAt.getTime() >= 7 * DAY);
  const returned = matured.filter((u) => u.lastActiveAt && u.lastActiveAt.getTime() - u.createdAt.getTime() >= DAY);

  // How often people visit: distinct active days per active person in the range.
  const daysPerPerson = new Map<string, Set<string>>();
  for (const e of rangeEvents) {
    if (!e.userId) continue;
    const set = daysPerPerson.get(e.userId) ?? new Set<string>();
    set.add(dayKey(e.createdAt));
    daysPerPerson.set(e.userId, set);
  }
  const visitDays = [...daysPerPerson.values()].map((s) => s.size);

  return {
    range: { from: from.toISOString(), to: to.toISOString(), days },
    trackingSince: firstEvent?.createdAt.toISOString() ?? null,
    users: {
      total: people.length,
      newToday: signups.filter((d) => d >= startOfToday).length,
      newWeek: signups.filter((d) => now.getTime() - d.getTime() <= 7 * DAY).length,
      newMonth: signups.filter((d) => now.getTime() - d.getTime() <= 30 * DAY).length,
      newInRange: signups.filter((d) => inRange(d, from, to)).length,
      newPerDay,
      totalPerDay,
      growthTrend: trend(newPerDay),
    },
    activity: {
      active7: activeSince(7 * DAY),
      active30: activeSince(30 * DAY),
      activeByDay,
      activeInRange: daysPerPerson.size,
      avgVisitDays: visitDays.length ? visitDays.reduce((a, b) => a + b, 0) / visitDays.length : null,
      activityTrend: trend(activeByDay),
      featureUse,
    },
    content: {
      outfitsInRange: outfits.filter((o) => inRange(o.createdAt, from, to)).length,
      outfitsPerDay: countByDay(outfits.map((o) => o.createdAt), days),
      outfitsTotal: outfits.length,
      savedLooksTotal: outfits.filter((o) => o.isFavorite).length,
      looksSavedInRange: named("look_saved").length,
      uploadsInRange: uploads.filter((i) => inRange(i.createdAt, from, to)).length,
      uploadsPerDay: countByDay(uploads.map((i) => i.createdAt), days),
      uploadsTotal: uploads.length,
      peopleWithOutfits: new Set(outfits.map((o) => o.userId)).size,
      peopleWithUploads: new Set(uploads.map((i) => i.userId)).size,
    },
    performance: {
      outfitGeneration: outcome("outfit_generate"),
      tryOn: outcome("tryon"),
      clothesDetection: outcome("clothes_detect"),
    },
    retention: {
      eligible: matured.length,
      returned: returned.length,
      rate: matured.length ? returned.length / matured.length : null,
    },
  };
}

export type AdminStats = Awaited<ReturnType<typeof computeAdminStats>>;
