import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingEnabled } from "@/lib/billing";

export type BillingStatus = {
  enabled: boolean;
  signedIn: boolean;
  /** The trial: never started (null), or when it started and ends. */
  trial: { startedAt: string; endsAt: string; active: boolean } | null;
  subscribed: boolean;
};

/** What the trial and plan screens need to know about the signed-in person (nothing about cards or payments). */
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store" };
  const enabled = billingEnabled();
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ enabled, signedIn: false, trial: null, subscribed: false } satisfies BillingStatus, { headers });
  const [row, open] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { trialStartedAt: true, trialEndsAt: true } }),
    prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ["active", "past_due"] } }, select: { id: true } }),
  ]);
  const trial =
    row?.trialStartedAt && row.trialEndsAt
      ? { startedAt: row.trialStartedAt.toISOString(), endsAt: row.trialEndsAt.toISOString(), active: row.trialEndsAt.getTime() > Date.now() }
      : null;
  return NextResponse.json({ enabled, signedIn: true, trial, subscribed: Boolean(open) } satisfies BillingStatus, { headers });
}
