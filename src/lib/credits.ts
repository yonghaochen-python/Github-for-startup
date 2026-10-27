import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PLAN_ALLOWANCES, isPlanKey, type CreditKind, type PlanKey } from "@/lib/plans";

/**
 * Photo and live try-on credits. Each person has a plan (free / plus / pro) with a monthly allowance per kind, and
 * may have extra credits (added by an admin until purchases exist). Everything is worked out from the CreditEntry
 * history, which is only ever added to:
 *
 *   plan left  = allowance − plan uses this period (never below 0)
 *   extra left = extra added − extra used
 *   total      = plan left + extra left            (photo and live separately, never mixed)
 *
 * A use is reserved before the paid work starts, then completed (counted) or released (given back), so a failed
 * try-on costs nothing. A request id makes repeats count once. A new period simply counts plan uses from zero again;
 * extra credits are never reset. Plan changes only change the allowance.
 *
 * Limits are "count-only" unless the server setting CREDIT_ENFORCEMENT is "block": usage is recorded and shown, but
 * nobody is stopped. Admins are never stopped; their uses are recorded with source "admin".
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

export type Balances = {
  plan: PlanKey;
  period: { start: string; end: string };
  photo: KindBalance;
  live: KindBalance;
  enforcement: Enforcement;
  /** Admins are never limited. */
  exempt: boolean;
};

type Account = { id: string; role: string };

async function accountPlan(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, periodAnchor: true, createdAt: true, role: true } });
  if (!user) throw new Error("No such account.");
  const plan: PlanKey = isPlanKey(user.plan) ? user.plan : "free";
  return { plan, role: user.role, period: currentPeriod(user.periodAnchor ?? user.createdAt) };
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

export async function getBalances(userId: string): Promise<Balances> {
  const { plan, role, period } = await accountPlan(userId);
  const [photo, live] = await Promise.all([kindBalance(userId, "photo", plan, period), kindBalance(userId, "live", plan, period)]);
  return {
    plan,
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    photo,
    live,
    enforcement: enforcement(),
    exempt: role === "admin",
  };
}

/* ---------- Using credits ---------- */

export type Reservation = { ok: true; duplicate: boolean } | { ok: false; reason: "no_credits" };

/**
 * Reserves one credit of `kind` for this request, before the paid work starts. Plan allowance first, then extra;
 * beyond both it's "over" (allowed in count-only mode, refused when blocking). The check and the insert are one
 * database statement, so two requests at once can't both take the last credit, and a request id already used is
 * never counted again (duplicate: true).
 */
export async function reserveCredit(account: Account, kind: CreditKind, requestId: string): Promise<Reservation> {
  const userId = account.id;
  const existing = await prisma.creditEntry.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { id: true } });
  if (existing) return { ok: true, duplicate: true };

  const { plan, period } = await accountPlan(userId);
  const balance = await kindBalance(userId, kind, plan, period);
  const source = account.role === "admin" ? "admin" : balance.planLeft > 0 ? "plan" : balance.extraLeft > 0 ? "extra" : "over";
  if (source === "over" && enforcement() === "block") return { ok: false, reason: "no_credits" };

  const start = dbDate(period.start);
  const end = dbDate(period.end);
  const allowance = PLAN_ALLOWANCES[plan][kind];
  // Inserted only if this request id is new and the chosen source still has room at this very moment.
  const inserted = await prisma.$executeRaw`
    INSERT INTO "CreditEntry" ("id", "userId", "kind", "type", "source", "amount", "status", "requestId", "createdAt")
    SELECT ${randomUUID()}, ${userId}, ${kind}, 'use', ${source}, -1, 'reserved', ${requestId}, ${dbDate(new Date())}
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
  if (inserted === 1) return { ok: true, duplicate: false };

  // Not inserted: either the same request already landed, or the last credit was just taken by another request.
  const raced = await prisma.creditEntry.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { id: true } });
  if (raced) return { ok: true, duplicate: true };
  if (enforcement() === "block") return { ok: false, reason: "no_credits" };
  // Count-only: record it as over the limit rather than losing the record.
  await prisma.creditEntry
    .create({ data: { userId, kind, type: "use", source: "over", amount: -1, status: "reserved", requestId } })
    .catch(() => {});
  return { ok: true, duplicate: false };
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
 */
export async function withCredit<T>(account: Account, kind: CreditKind, requestId: string, run: () => Promise<T>, isReal: (result: T) => boolean): Promise<T> {
  const reservation = await reserveCredit(account, kind, requestId);
  if (!reservation.ok) {
    throw new CreditError("no_credits", kind === "photo" ? "You've used this month's photo try-ons." : "You've used this month's live sessions.");
  }
  if (reservation.duplicate) throw new CreditError("duplicate", "That try-on was already sent. Please wait for it to finish.");
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
