import { prisma } from "@/lib/prisma";
import { isGood } from "@/lib/feedback";
import { STUDIO_MODULE_IDS } from "@/lib/studioModules";
import { CONVERSION_DAYS } from "@/lib/plans";
import { LIVE_MICROS_PER_SECOND, MAX_LIVE_SECONDS, PHOTO_TRYON_MICROS } from "@/lib/aiCosts";

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
  { key: "shop", label: "Shopping" },
  { key: "closet", label: "My Closet" },
  { key: "studio", label: "Studio" },
  { key: "stylist", label: "AI Stylist" },
  { key: "planner", label: "Planner" },
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
      select: { userId: true, name: true, ok: true, durationMs: true, createdAt: true, costMicros: true },
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

  // Good / Bad ratings in the range, per kind of result, and how many gave the month's thank-you credits.
  const ratings = await prisma.feedback.findMany({ where: { updatedAt: { gte: from, lte: to } }, select: { kind: true, rating: true, rewardPeriod: true } });
  const feedback = (["photo", "live", "outfit", "stylist"] as const).map((kind) => {
    const of = ratings.filter((r) => r.kind === kind);
    const reasons: Record<string, number> = {};
    for (const r of of) reasons[r.rating] = (reasons[r.rating] ?? 0) + 1;
    const good = of.filter((r) => isGood(r.rating)).length;
    return { kind, good, bad: of.length - good, rewarded: of.filter((r) => r.rewardPeriod).length, reasons };
  });

  // AI Stylist analyses in the range, per type: real ones (each one AI call and one photo credit) and their AI cost.
  // Practice reports (no AI) and admins' own are counted apart, so testing doesn't inflate the numbers.
  const reports = await prisma.studioReport.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { userId: true, module: true, status: true, practice: true, costMicros: true },
  });
  const stylist = STUDIO_MODULE_IDS.map((module) => {
    const of = reports.filter((r) => r.module === module && !adminIds.has(r.userId));
    const real = of.filter((r) => r.status === "ready" && !r.practice);
    return {
      module,
      made: real.length,
      people: new Set(real.map((r) => r.userId)).size,
      failed: of.filter((r) => r.status === "failed").length,
      costMicros: real.reduce((sum, r) => sum + (r.costMicros ?? 0), 0),
      admin: reports.filter((r) => r.module === module && adminIds.has(r.userId) && r.status === "ready").length,
    };
  });

  // AI costs in the range, per feature: new results (each one paid AI work) with what they really cost, and free
  // reuse (results shown again, reopened or made without AI) apart. Everyone's usage counts here, admins' included,
  // because it's real spending; the admins' share is shown on its own.
  const costEvents = allEvents.filter((e) => inRange(e.createdAt, from, to));
  const withName = (name: string) => costEvents.filter((e) => e.name === name);
  const credits = await prisma.creditEntry.findMany({
    where: { type: "use", status: "completed", createdAt: { gte: from, lte: to } },
    select: { userId: true, kind: true, requestId: true, note: true },
  });
  const photoUses = credits.filter((c) => c.kind === "photo" && !c.requestId.startsWith("studio-"));
  const liveUses = credits.filter((c) => c.kind === "live");
  const liveSeconds = (note: string | null) => {
    const m = /^seconds:(\d+)$/.exec(note ?? "");
    return m ? Math.min(MAX_LIVE_SECONDS, Number(m[1])) : null;
  };
  const realReports = reports.filter((r) => r.status === "ready" && !r.practice);
  const fromEvents = (name: string) => {
    const of = withName(name);
    return { made: of.length, costMicros: of.reduce((sum, e) => sum + (e.costMicros ?? 0), 0), adminMicros: of.filter((e) => e.userId && adminIds.has(e.userId)).reduce((sum, e) => sum + (e.costMicros ?? 0), 0) };
  };
  type CostRow = { key: string; label: string; made: number; costMicros: number; estimatedMicros: number; adminMicros: number; reused: number | null; free?: true };
  const liveMeasured = liveUses.filter((c) => liveSeconds(c.note) !== null);
  const liveUnmeasured = liveUses.length - liveMeasured.length;
  const aiCosts: CostRow[] = [
    {
      key: "photo",
      label: "Photo try-on",
      made: photoUses.length,
      costMicros: 0,
      estimatedMicros: photoUses.length * PHOTO_TRYON_MICROS,
      adminMicros: photoUses.filter((c) => adminIds.has(c.userId)).length * PHOTO_TRYON_MICROS,
      reused: withName("tryon_reused").length,
    },
    {
      key: "live",
      label: "Live try-on",
      made: liveUses.length,
      costMicros: liveMeasured.reduce((sum, c) => sum + liveSeconds(c.note)! * LIVE_MICROS_PER_SECOND, 0),
      // A session whose length never came back (the page closed first) is counted at the full 20 seconds.
      estimatedMicros: liveUnmeasured * MAX_LIVE_SECONDS * LIVE_MICROS_PER_SECOND,
      adminMicros: liveUses
        .filter((c) => adminIds.has(c.userId))
        .reduce((sum, c) => sum + (liveSeconds(c.note) ?? MAX_LIVE_SECONDS) * LIVE_MICROS_PER_SECOND, 0),
      reused: null,
    },
    {
      key: "stylist",
      label: "AI Stylist report",
      made: realReports.length,
      costMicros: realReports.reduce((sum, r) => sum + (r.costMicros ?? 0), 0),
      estimatedMicros: 0,
      adminMicros: realReports.filter((r) => adminIds.has(r.userId)).reduce((sum, r) => sum + (r.costMicros ?? 0), 0),
      reused: withName("report_opened").length,
    },
    { key: "closet", label: "Adding clothes", ...fromEvents("ai_cost_closet"), estimatedMicros: 0, reused: null },
    { key: "style", label: "Style it", ...fromEvents("ai_cost_style_it"), estimatedMicros: 0, reused: withName("style_it_reused").length },
    { key: "explain", label: "Outfit explanations", ...fromEvents("ai_cost_explain"), estimatedMicros: 0, reused: null },
    (() => {
      // AI clothing enhancement (admins only for now): BFL's own reported cost, or the set rate when a reply didn't say.
      const exact = withName("ai_cost_enhance");
      const est = withName("ai_cost_enhance_est");
      const sum = (list: typeof exact) => list.reduce((total, e) => total + (e.costMicros ?? 0), 0);
      const admins = (list: typeof exact) => list.filter((e) => e.userId && adminIds.has(e.userId));
      return {
        key: "enhance",
        label: "Clothing enhancement",
        made: exact.length + est.length,
        costMicros: sum(exact),
        estimatedMicros: sum(est),
        adminMicros: sum(admins(exact)) + sum(admins(est)),
        reused: withName("enhance_reused").length,
      };
    })(),
    { key: "planner", label: "Planner", made: withName("planner_generated").length, costMicros: 0, estimatedMicros: 0, adminMicros: 0, reused: null, free: true },
  ];

  const billing = await billingStats(adminIds, from, to, now);

  // Photo try-on down on Virm's side (out of balance, key rejected), counted for everyone including admins.
  const downEvents = allEvents.filter((e) => e.name === "tryon_service_down" && now.getTime() - e.createdAt.getTime() <= DAY);
  const alerts = {
    tryOnDown: downEvents.length,
    tryOnDownLastAt: downEvents.reduce<Date | null>((last, e) => (!last || e.createdAt > last ? e.createdAt : last), null)?.toISOString() ?? null,
  };

  return {
    alerts,
    billing,
    aiCosts,
    stylist,
    feedback,
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
    // "Share looks": picks shared → friends who opened a link → votes → people who signed up after arriving from one.
    picks: {
      created: named("pick_created").length,
      opened: named("pick_opened").length,
      votes: named("pick_vote").length,
      signups: named("signup_from_pick").length,
    },
    retention: {
      eligible: matured.length,
      returned: returned.length,
      rate: matured.length ? returned.length / matured.length : null,
    },
  };
}

export type AdminStats = Awaited<ReturnType<typeof computeAdminStats>>;

const PAID_STATUSES = ["active", "past_due", "unpaid", "canceled"];

/**
 * Trials and Plus (admins left out). The key number is trial-to-paid: of trials that have ended, the share whose
 * account started paying for Plus by 14 days after the trial ended (paying during the trial counts too). A trial
 * that ended less than 14 days ago without paying isn't counted yet, since it still could.
 */
async function billingStats(adminIds: Set<string>, from: Date, to: Date, now: Date) {
  const [trials, subs] = await Promise.all([
    prisma.user.findMany({
      where: { trialStartedAt: { not: null } },
      select: { id: true, trialStartedAt: true, trialEndsAt: true, trialCardFingerprint: true },
    }),
    prisma.subscription.findMany({ select: { userId: true, status: true, createdAt: true, cancelAtPeriodEnd: true } }),
  ]);
  const people = trials.filter((t) => !adminIds.has(t.id));
  const paid = subs.filter((s) => !adminIds.has(s.userId) && PAID_STATUSES.includes(s.status));
  const firstPaid = new Map<string, Date>();
  for (const s of paid) {
    const was = firstPaid.get(s.userId);
    if (!was || s.createdAt < was) firstPaid.set(s.userId, s.createdAt);
  }

  const ended = people.filter((t) => t.trialEndsAt && t.trialEndsAt <= now);
  const converted = ended.filter((t) => {
    const p = firstPaid.get(t.id);
    return p && p.getTime() <= t.trialEndsAt!.getTime() + CONVERSION_DAYS * DAY;
  });
  const decided = ended.filter((t) => converted.includes(t) || now.getTime() - t.trialEndsAt!.getTime() >= CONVERSION_DAYS * DAY);

  // The same card on more than one account's trial (only ever a flag to look at, never a block).
  const byCard = new Map<string, number>();
  for (const t of people) if (t.trialCardFingerprint) byCard.set(t.trialCardFingerprint, (byCard.get(t.trialCardFingerprint) ?? 0) + 1);

  const open = subs.filter((s) => !adminIds.has(s.userId) && (s.status === "active" || s.status === "past_due"));
  return {
    trialsStarted: people.length,
    trialsInRange: people.filter((t) => inRange(t.trialStartedAt!, from, to)).length,
    trialsActive: people.filter((t) => t.trialEndsAt && t.trialEndsAt > now).length,
    trialsEnded: ended.length,
    trialsDecided: decided.length,
    trialsConverted: converted.length,
    conversionRate: decided.length ? converted.length / decided.length : null,
    plusMembers: open.length,
    paymentFailing: open.filter((s) => s.status === "past_due").length,
    cancelling: open.filter((s) => s.cancelAtPeriodEnd).length,
    sharedCardAccounts: [...byCard.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
  };
}
