import { prisma } from "@/lib/prisma";
import { TRIAL_ALLOWANCES, TRIAL_DAYS, TRIAL_KINDS } from "@/lib/plans";

/**
 * The 7-day Plus trial. It starts once per account (trialStartedAt is set once and never cleared) and ends by date:
 * nothing has to run to end it, and nothing is ever charged when it does. Its credits are granted once, as their own
 * entries (source "trial"), so they never mix with monthly, extra or purchased credits, and they stop counting when
 * the trial ends. In the live app a trial starts only from Stripe's verified confirmation that a card was saved.
 */

export type TrialStart = { started: true; endsAt: Date } | { started: false; reason: "already_used" };

/** Starts the trial now (if this account never had one) and grants its credits. Safe to call again. */
export async function startTrial(userId: string, cardFingerprint: string | null = null, now = new Date()): Promise<TrialStart> {
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  // Only an account that never had a trial: two calls at once can't both start one.
  const { count } = await prisma.user.updateMany({
    where: { id: userId, trialStartedAt: null },
    data: { trialStartedAt: now, trialEndsAt: endsAt, trialCardFingerprint: cardFingerprint },
  });
  if (count === 0) return { started: false, reason: "already_used" };
  await grantTrialCredits(userId);
  return { started: true, endsAt };
}

/** The trial's credits, once each (a fixed request id per kind, so granting again adds nothing). */
export async function grantTrialCredits(userId: string): Promise<void> {
  for (const kind of TRIAL_KINDS) {
    await prisma.creditEntry
      .create({
        data: {
          userId,
          kind,
          type: "adjustment",
          source: "trial",
          amount: TRIAL_ALLOWANCES[kind],
          status: "completed",
          requestId: `trial-grant-${kind}`,
          note: "7-day Plus trial",
        },
      })
      .catch(() => {}); // Already granted (the request id is unique per account).
  }
}
