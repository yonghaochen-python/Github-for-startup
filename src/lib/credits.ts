import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { KIND_NAMES, PLAN_ALLOWANCES, TRIAL_ALLOWANCES, TRIAL_KINDS, isPlanKey, type CreditKind, type PlanKey, type TrialKind } from "@/lib/plans";

/**
 * Credits for paid AI work: photo try-ons, live try-ons, clothing photos tagged by AI and Style It searches. Each
 * person has a plan (free / plus / pro) with a monthly allowance per kind, may have a running 7-day trial with its own
 * allowances (used first, kept apart, expiring with the trial), and may have extra credits (added by an admin until
 * purchases exist; never reset or expired). Everything is worked out from the CreditEntry history, which is only
 * ever added to:
 *
 *   plan left  = allowance − plan uses this period (never below 0)
 *   extra left = extra added − extra used
 *   total      = plan left + extra left            (photo and live separately, never mixed)
 *
 * A use is reserved before the paid work starts, then completed (counted) or released (given back), so a failed
 * try-on costs nothing. A request id makes repeats count once. A new period simply counts plan uses from zero again;
 * extra credits are never reset. Plan changes only change the allowance.
 *
 * Limits stop people when the server setting CREDIT_ENFORCEMENT is "block" (the setting for Virm); "count" only
 * records them. Live try-ons always stop at the limit. Admins are never stopped; their uses are recorded with source
 * "admin". Showing a result again (a reopened report, a saved try-on, a repeated search) never reserves a credit.
 */

export type Enforcement = "count" | "block";
export const enforcement = (): Enforcement => (process.env.CREDIT_ENFORCEMENT === "block" ? "block" : "count");

/* ---------- Monthly periods ---------- */

/** The anchor moved n months on, kept on its day of the month where it exists (Jan 31 → Feb 28/29 → Mar 31). */
export function addMonths(anchor: Date, n: number): Date {
  const total = anchor.getUTCMonth() + n;
  const year = anchor.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds())
  );
}

/** The monthly period containing `now`, counted from the anchor. */
export function currentPeriod(anchor: Date, now = new Date()): { start: Date; end: Date } {
  if (now < anchor) return { start: anchor, end: addMonths(anchor, 1) };
  let n = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  while (n > 0 && addMonths(anchor, n) > now) n--;
  while (addMonths(anchor, n + 1) <= now) n++;
  return { start: addMonths(anchor, n), end: addMonths(anchor, n + 1) };
}

/** Dates as the database stores them (text, e.g. 2026-11-14T16:02:38.672+00:00), so raw comparisons line up. */
const dbDate = (d: Date) => d.toISOString().replace("Z", "+00:00");

/* ---------- Balances ---------- */

export type KindBalance = {
  allowance: number;
  planUsed: number;
  planLeft: number;
  extraLeft: number;
  total: number;
  /** Uses beyond the limit (recorded in count-only mode). */
  overLimit: number;
};

export type TrialBalance = {
  startedAt: string;
  endsAt: string;
  allowance: Record<TrialKind, number>;
  left: Record<TrialKind, number>;
  /** AI Stylist report types already covered by the trial (one of each type). */
  reports: string[];
};

export type Balances = {
  plan: PlanKey;
  period: { start: string; end: string };
  photo: KindBalance;
  live: KindBalance;
  closet: KindBalance;
  style: KindBalance;
  /** The 7-day Plus trial, while it's running (null otherwise; ended trials no longer count). */
  trial: TrialBalance | null;
  enforcement: Enforcement;
  /** Admins are never limited. */
  exempt: boolean;
  /** This month's photo credits used, by what made them (sent by /api/me/credits). */
  photoUsed?: { tryOns: number; reports: number };
};

type Account = { id: string; role: string };

/**
 * The person's plan right now, worked out on the server only: a confirmed active Plus subscription, otherwise the plan
 * an admin set (Free by default). Plus the running trial, if any (it ends by date, so nothing needs to switch it off).
 */
export async function accountPlan(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true, periodAnchor: true, createdAt: true, role: true, trialStartedAt: true, trialEndsAt: true } }),
    // Plus stays on while Stripe retries a failed renewal ("past_due"); it ends when Stripe cancels it.
    prisma.subscription.findFirst({ where: { userId, status: { in: ["active", "past_due"] } }, select: { plan: true } }),
  ]);
  if (!user) throw new Error("No such account.");
  const subscribed = subscription && isPlanKey(subscription.plan) ? subscription.plan : null;
  const plan: PlanKey = subscribed ?? (isPlanKey(user.plan) ? user.plan : "free");
  const now = new Date();
  const trial = user.trialStartedAt && user.trialEndsAt && user.trialEndsAt > now ? { startedAt: user.trialStartedAt, endsAt: user.trialEndsAt } : null;
  return { plan, role: user.role, period: currentPeriod(user.periodAnchor ?? user.createdAt), trial };
}

async function kindBalance(userId: string, kind: CreditKind, plan: PlanKey, period: { start: Date; end: Date }): Promise<KindBalance> {
  const inPeriod = { gte: period.start, lt: period.end };
  const [planUsed, overLimit, extra] = await Promise.all([
    prisma.creditEntry.count({ where: { userId, kind, type: "use", source: "plan", status: { not: "released" }, createdAt: inPeriod } }),
    prisma.creditEntry.count({ where: { userId, kind, type: "use", source: "over", status: { not: "released" }, createdAt: inPeriod } }),
    prisma.creditEntry.aggregate({ where: { userId, kind, source: "extra", status: { not: "released" } }, _sum: { amount: true } }),
  ]);
  const allowance = PLAN_ALLOWANCES[plan][kind];
  const planLeft = Math.max(0, allowance - planUsed);
  const extraLeft = Math.max(0, extra._sum.amount ?? 0);
  return { allowance, planUsed, planLeft, extraLeft, total: planLeft + extraLeft, overLimit };
}

/** Trial credits left of one kind: granted once when the trial started, minus what's been used (0 once it ends). */
async function trialLeft(userId: string, kind: TrialKind): Promise<number> {
  const [granted, used] = await Promise.all([
    prisma.creditEntry.aggregate({ where: { userId, kind, source: "trial", type: "adjustment" }, _sum: { amount: true } }),
    prisma.creditEntry.count({ where: { userId, kind, source: "trial", type: "use", status: { not: "released" } } }),
  ]);
  return Math.max(0, (granted._sum.amount ?? 0) - used);
}

/** The AI Stylist report types the trial already covered (one of each type). */
async function trialReports(userId: string): Promise<string[]> {
  const rows = await prisma.creditEntry.findMany({
    where: { userId, kind: "report", source: "trial", type: "use", status: { not: "released" } },
    select: { note: true },
  });
  return [...new Set(rows.map((r) => r.note ?? "").filter(Boolean))];
}

/** Whether the trial still covers a report of this type (each type once, while the trial runs and has reports left). */
export async function trialCoversReport(userId: string, module: string): Promise<boolean> {
  const { trial } = await accountPlan(userId);
  if (!trial) return false;
  const [left, done] = await Promise.all([trialLeft(userId, "report"), trialReports(userId)]);
  return left > 0 && !done.includes(module);
}

/** What this account's trial granted of each kind (7-day or 14-day trial). */
async function trialGranted(userId: string): Promise<Record<TrialKind, number>> {
  const rows = await prisma.creditEntry.groupBy({
    by: ["kind"],
    where: { userId, source: "trial", type: "adjustment" },
    _sum: { amount: true },
  });
  const sums = new Map(rows.map((r) => [r.kind, r._sum.amount ?? 0]));
  return Object.fromEntries(TRIAL_KINDS.map((kind) => [kind, sums.get(kind) ?? TRIAL_ALLOWANCES[kind]])) as Record<TrialKind, number>;
}

export async function getBalances(userId: string): Promise<Balances> {
  const { plan, role, period, trial } = await accountPlan(userId);
  const [photo, live, closet, style] = await Promise.all(
    (["photo", "live", "closet", "style"] as const).map((kind) => kindBalance(userId, kind, plan, period))
  );
  let trialBalance: TrialBalance | null = null;
  if (trial) {
    const lefts = await Promise.all(TRIAL_KINDS.map((kind) => trialLeft(userId, kind)));
    trialBalance = {
      startedAt: trial.startedAt.toISOString(),
      endsAt: trial.endsAt.toISOString(),
      allowance: await trialGranted(userId),
      left: Object.fromEntries(TRIAL_KINDS.map((kind, i) => [kind, lefts[i]])) as Record<TrialKind, number>,
      reports: await trialReports(userId),
    };
  }
  return {
    plan,
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    photo,
    live,
    closet,
    style,
    trial: trialBalance,
    enforcement: enforcement(),
    exempt: role === "admin",
  };
}

/* ---------- Using credits ---------- */

export type Reservation =
  | { ok: true; duplicate: boolean; source?: "trial" | "plan" | "extra" | "over" | "admin"; trialUsedUp?: boolean }
  | { ok: false; reason: "no_credits"; allowance: number; resetsAt: string };

/** What the trial may cover for this request: its kind (reports have their own), and for reports, the report type. */
export type TrialUse = { kind: TrialKind; note?: string; allowed?: boolean };

/**
 * Reserves one credit for this request, before the paid work starts. Order: the running trial's credits (when the
 * request may use them), then the monthly allowance, then extra credits; beyond all of them it's "over" (refused when
 * blocking, recorded in count-only mode). Each check and insert is one database statement, so two requests at once
 * can't both take the last credit, and a request id already used is never counted again (duplicate: true).
 */
export async function reserveCredit(
  account: Account,
  kind: CreditKind,
  requestId: string,
  options: { block?: boolean; trial?: TrialUse } = {}
): Promise<Reservation> {
  const userId = account.id;
  // Live sessions always stop at the limit (each one is billed by the second), whatever CREDIT_ENFORCEMENT says.
  const block = options.block || enforcement() === "block";
  const existing = await prisma.creditEntry.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { id: true } });
  if (existing) return { ok: true, duplicate: true };

  const { plan, period, trial } = await accountPlan(userId);
  const now = dbDate(new Date());

  // The trial first, while it runs (admins are recorded as admin, never from the trial).
  let trialUsedUp = false;
  if (account.role !== "admin" && trial && options.trial && options.trial.allowed !== false) {
    const tk = options.trial.kind;
    const ends = dbDate(trial.endsAt);
    const inserted = await prisma.$executeRaw`
      INSERT INTO "CreditEntry" ("id", "userId", "kind", "type", "source", "amount", "status", "requestId", "note", "createdAt")
      SELECT ${randomUUID()}, ${userId}, ${tk}, 'use', 'trial', -1, 'reserved', ${requestId}, ${options.trial.note ?? null}, ${now}
      WHERE NOT EXISTS (SELECT 1 FROM "CreditEntry" WHERE "userId" = ${userId} AND "requestId" = ${requestId})
        AND ${now} < ${ends}
        AND (
          SELECT COALESCE(SUM("amount"), 0) FROM "CreditEntry"
          WHERE "userId" = ${userId} AND "kind" = ${tk} AND "source" = 'trial' AND "type" = 'adjustment'
        ) > (
          SELECT COUNT(*) FROM "CreditEntry"
          WHERE "userId" = ${userId} AND "kind" = ${tk} AND "source" = 'trial' AND "type" = 'use' AND "status" != 'released'
        )`;
    if (inserted === 1) return { ok: true, duplicate: false, source: "trial" };
    const raced = await prisma.creditEntry.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { id: true } });
    if (raced) return { ok: true, duplicate: true };
    // This trial allowance is used up: the request falls back to the person's normal credits.
    trialUsedUp = true;
  }

  const balance = await kindBalance(userId, kind, plan, period);
  const source = account.role === "admin" ? "admin" : balance.planLeft > 0 ? "plan" : balance.extraLeft > 0 ? "extra" : "over";
  const refused = { ok: false as const, reason: "no_credits" as const, allowance: balance.allowance, resetsAt: period.end.toISOString() };
  if (source === "over" && block) return refused;

  const start = dbDate(period.start);
  const end = dbDate(period.end);
  const allowance = PLAN_ALLOWANCES[plan][kind];
  // Inserted only if this request id is new and the chosen source still has room at this very moment.
  const inserted = await prisma.$executeRaw`
    INSERT INTO "CreditEntry" ("id", "userId", "kind", "type", "source", "amount", "status", "requestId", "createdAt")
    SELECT ${randomUUID()}, ${userId}, ${kind}, 'use', ${source}, -1, 'reserved', ${requestId}, ${now}
    WHERE NOT EXISTS (SELECT 1 FROM "CreditEntry" WHERE "userId" = ${userId} AND "requestId" = ${requestId})
      AND (
        ${source} IN ('admin', 'over')
        OR (${source} = 'plan' AND (
          SELECT COUNT(*) FROM "CreditEntry"
          WHERE "userId" = ${userId} AND "kind" = ${kind} AND "type" = 'use' AND "source" = 'plan'
            AND "status" != 'released' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        ) < ${allowance})
        OR (${source} = 'extra' AND (
          SELECT COALESCE(SUM("amount"), 0) FROM "CreditEntry"
          WHERE "userId" = ${userId} AND "kind" = ${kind} AND "source" = 'extra' AND "status" != 'released'
        ) > 0)
      )`;
  if (inserted === 1) return { ok: true, duplicate: false, source, trialUsedUp };

  // Not inserted: either the same request already landed, or the last credit was just taken by another request.
  const raced = await prisma.creditEntry.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { id: true } });
  if (raced) return { ok: true, duplicate: true };
  if (block) return refused;
  // Count-only: record it as over the limit rather than losing the record.
  await prisma.creditEntry
    .create({ data: { userId, kind, type: "use", source: "over", amount: -1, status: "reserved", requestId } })
    .catch(() => {});
  return { ok: true, duplicate: false, source: "over", trialUsedUp };
}

/** A month's date in words ("Dec 6"). */
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What to tell someone whose limit stopped a request: which allowance, and when it comes back. */
export function limitMessage(kind: CreditKind, reservation: { allowance: number; resetsAt: string }): string {
  // Photo credits pay for photo try-ons and AI Stylist reports alike, so they're named as credits here.
  const noun = kind === "photo" ? "photo credits" : KIND_NAMES[kind];
  return `You've used this month's ${reservation.allowance} ${noun}. They reset on ${shortDate(reservation.resetsAt)}.`;
}

/**
 * Live sessions started since midnight (UTC) that weren't given back: one person's, or everyone's but admins'.
 * Worked out from CreditEntry, so it holds across Workers (unlike a count kept in memory).
 */
export async function liveUsesToday(userId?: string): Promise<number> {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return prisma.creditEntry.count({
    where: { kind: "live", type: "use", status: { not: "released" }, createdAt: { gte: midnight }, ...(userId ? { userId } : { source: { not: "admin" } }) },
  });
}

/**
 * Finishes a reserved credit: "completed" counts it, "released" gives it back. Only a reserved entry changes, so
 * calling this again (or after another outcome) does nothing; it returns whether anything changed.
 */
export async function settleCredit(userId: string, requestId: string, status: "completed" | "released", outcome?: string): Promise<boolean> {
  const { count } = await prisma.creditEntry.updateMany({
    where: { userId, requestId, status: "reserved" },
    data: { status, outcome: outcome ?? null, settledAt: new Date() },
  });
  return count === 1;
}

/* ---------- Admin tools (no billing yet) ---------- */

/** Changes a person's plan. Their period isn't reset; extra credits aren't touched. */
export async function setPlan(userId: string, plan: PlanKey): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { plan } });
}

/** Adds (or, with a negative amount, removes) extra credits, recorded as an admin adjustment, never a purchase. */
export async function adjustExtraCredits(userId: string, kind: CreditKind, amount: number, note: string): Promise<void> {
  await prisma.creditEntry.create({
    data: { userId, kind, type: "adjustment", source: "extra", amount, status: "completed", requestId: `adjust-${randomUUID()}`, note: note.slice(0, 200) },
  });
}

/* ---------- Running a paid try-on with a credit ---------- */

export class CreditError extends Error {
  constructor(
    public code: "no_credits" | "duplicate",
    message: string
  ) {
    super(message);
  }
}

/** A client's request id if it's a sensible one, otherwise a fresh id (older pages send none). */
export function requestIdFrom(value: unknown): string {
  return typeof value === "string" && /^[\w-]{8,100}$/.test(value) ? value : randomUUID();
}

/**
 * Runs paid work with one credit: reserved first, counted only if `isReal` says a real result came back, given
 * back on any failure (marked timed_out when the provider ran out of time, since it may still have billed us).
 * `trial` says what the 7-day trial may cover for this request (used first while it runs).
 */
export async function withCredit<T>(
  account: Account,
  kind: CreditKind,
  requestId: string,
  run: () => Promise<T>,
  isReal: (result: T) => boolean,
  options: { trial?: TrialUse } = {}
): Promise<T> {
  const reservation = await reserveCredit(account, kind, requestId, { trial: options.trial });
  if (!reservation.ok) throw new CreditError("no_credits", limitMessage(kind, reservation));
  if (reservation.duplicate) throw new CreditError("duplicate", "That request was already sent. Please wait for it to finish.");
  try {
    const result = await run();
    const real = isReal(result);
    await settleCredit(account.id, requestId, real ? "completed" : "released", real ? undefined : "not_real");
    return result;
  } catch (err) {
    const timedOut = err instanceof Error && /too long|in time/i.test(err.message);
    await settleCredit(account.id, requestId, "released", timedOut ? "timed_out" : "failed").catch(() => {});
    throw err;
  }
}
