import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingEnabled, hasPaidForPlus, OPEN_STATUSES } from "@/lib/billing";
import { trialTerms, type TrialKind } from "@/lib/plans";

export type BillingStatus = {
  enabled: boolean;
  signedIn: boolean;
  /** The trial: never started (null), or when it started and ends. */
  trial: { startedAt: string; endsAt: string; active: boolean } | null;
  subscribed: boolean;
  /** Plus is open but its renewal payment failed (Stripe is retrying). */
  pastDue: boolean;
  /** Plus is set to stop at the end of the paid month (that date). */
  endsAt: string | null;
  /** Paid for Plus at some point (so no free trial, now or later). */
  hadPlus: boolean;
  /** Joined with a friend's invite code, so the trial is the 14-day one. */
  invited: boolean;
  /** The trial this person gets (or got): its length and exact allowances. */
  trialDays: number;
  trialAllowances: Record<TrialKind, number>;
};

/** What the trial and plan screens need to know about the signed-in person (nothing about cards or payments). */
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store" };
  const enabled = billingEnabled();
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ enabled, signedIn: false, trial: null, subscribed: false, pastDue: false, endsAt: null, hadPlus: false, invited: false, trialDays: trialTerms(false).days, trialAllowances: trialTerms(false).allowances } satisfies BillingStatus, { headers });
  const [row, open] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { trialStartedAt: true, trialEndsAt: true, invitedById: true } }),
    prisma.subscription.findFirst({ where: { userId: user.id, status: { in: OPEN_STATUSES } }, select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true } }),
  ]);
  const trial =
    row?.trialStartedAt && row.trialEndsAt
      ? { startedAt: row.trialStartedAt.toISOString(), endsAt: row.trialEndsAt.toISOString(), active: row.trialEndsAt.getTime() > Date.now() }
      : null;
  return NextResponse.json(
    {
      enabled,
      signedIn: true,
      trial,
      subscribed: open?.status === "active" || open?.status === "past_due",
      pastDue: open?.status === "past_due",
      endsAt: open?.cancelAtPeriodEnd && open.currentPeriodEnd ? open.currentPeriodEnd.toISOString() : null,
      hadPlus: await hasPaidForPlus(user.id),
      invited: Boolean(row?.invitedById),
      trialDays: trialTerms(Boolean(row?.invitedById)).days,
      trialAllowances: trialTerms(Boolean(row?.invitedById)).allowances,
    } satisfies BillingStatus,
    { headers }
  );
}
