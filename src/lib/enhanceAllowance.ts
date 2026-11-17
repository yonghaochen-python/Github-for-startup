import { prisma } from "@/lib/prisma";
import { getBalances } from "@/lib/credits";

/**
 * How many new AI enhancements a person may make this month: the same number as the clothing photos their plan
 * allows (Free 30, Plus 150, the trial's own number while it runs). Admins and SVIP have no limit. Pressing Enhance
 * again on the same picture reuses the kept result and is never counted. Counted from "enhance_used" events (one per
 * new enhancement), so the credit system itself doesn't change.
 */
export type EnhanceAllowance = { limit: number | null; used: number; left: number | null; resetsAt: string };

export async function enhanceAllowance(userId: string): Promise<EnhanceAllowance> {
  const balances = await getBalances(userId);
  const trial = balances.trial;
  // While a trial runs, its clothing-photo number (counted from the trial's start); otherwise the plan's, this month.
  const since = trial ? new Date(trial.startedAt) : new Date(balances.period.start);
  const resetsAt = trial ? trial.endsAt : balances.period.end;
  const used = await prisma.analyticsEvent.count({ where: { userId, name: "enhance_used", createdAt: { gte: since } } });
  if (balances.exempt || balances.svip) return { limit: null, used, left: null, resetsAt };
  const limit = trial ? trial.allowance.closet : balances.closet.allowance;
  return { limit, used, left: Math.max(0, limit - used), resetsAt };
}
