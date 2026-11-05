import { prisma } from "@/lib/prisma";
import { accountPlan, adjustExtraCredits } from "@/lib/credits";

/**
 * Feedback on a result: Good / Bad, or for AI Stylist reports Helpful / Not accurate / Not my style / Colors don't
 * look right / Suggestions aren't practical. Everyone can rate any result of their own once (and change their mind); the
 * first Bad in a monthly period on a real try-on (photo or live, one that actually ran) adds a one-time thank-you of
 * extra credits. Later Bads that period, and Bads on outfits or AI Stylist reports, are kept as feedback only.
 *
 * Everything is checked here, never by the page: the result must be the person's own, and the database's unique
 * index on (person, rewardPeriod) means two Bads at the same moment can't both be rewarded.
 */

export const FEEDBACK_KINDS = ["photo", "live", "outfit", "stylist"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
/** AI Stylist reports get more telling options than Good / Bad; anything but Helpful counts as a Bad. */
export const STYLIST_REASONS = ["helpful", "not_accurate", "not_my_style", "colors_off", "not_practical"] as const;
export type StylistReason = (typeof STYLIST_REASONS)[number];
export type Rating = "good" | "bad" | StylistReason;

/** Whether a rating counts as good (for totals and the thank-you rule). */
export const isGood = (rating: string) => rating === "good" || rating === "helpful";

/** The ratings each kind of result takes. */
export function ratingFor(kind: FeedbackKind, value: unknown): Rating | null {
  if (kind === "stylist") return (STYLIST_REASONS as readonly unknown[]).includes(value) ? (value as Rating) : null;
  return value === "good" || value === "bad" ? value : null;
}

/** The thank-you for the first Bad of the period. */
export const BAD_REWARD = { photo: 2, live: 2 } as const;

/** Only a Bad on a try-on (photo or live) earns the thank-you; Bads on other results are kept as feedback only. */
const REWARDED_KINDS: FeedbackKind[] = ["photo", "live"];

export class FeedbackError extends Error {}

/** Whether the result is this person's, and whether it was a real one (worth a thank-you if it went badly). */
async function checkTarget(userId: string, kind: FeedbackKind, targetId: string): Promise<{ real: boolean }> {
  if (kind === "photo" || kind === "live") {
    // A try-on or live session leaves a credit record under its request id; "completed" means it really ran.
    const use = await prisma.creditEntry.findFirst({ where: { userId, kind, type: "use", requestId: targetId }, select: { status: true } });
    // A try-on shown again from earlier (no new picture made) has no record: it can be rated, but isn't "real" here.
    return { real: use?.status === "completed" };
  }
  if (kind === "stylist") {
    const report = await prisma.studioReport.findFirst({ where: { userId, id: targetId, status: "ready" }, select: { practice: true } });
    if (!report) throw new FeedbackError("That report wasn't found.");
    return { real: !report.practice };
  }
  const outfit = await prisma.outfit.findFirst({ where: { userId, id: targetId }, select: { id: true } });
  if (!outfit) throw new FeedbackError("That outfit wasn't found.");
  return { real: true };
}

export async function submitFeedback(userId: string, kind: FeedbackKind, targetId: string, rating: Rating): Promise<{ rewarded: boolean }> {
  const { real } = await checkTarget(userId, kind, targetId);
  const row = await prisma.feedback.upsert({
    where: { userId_kind_targetId: { userId, kind, targetId } },
    create: { userId, kind, targetId, rating },
    update: { rating },
  });
  if (isGood(rating) || !real || row.rewardPeriod || !REWARDED_KINDS.includes(kind)) return { rewarded: false };

  // Claim this period's one thank-you; the unique index refuses a second claim in the same period.
  const { period } = await accountPlan(userId);
  const rewardPeriod = period.start.toISOString();
  const claimed = await prisma.feedback
    .update({ where: { id: row.id }, data: { rewardPeriod } })
    .then(() => true)
    .catch(() => false);
  if (!claimed) return { rewarded: false };

  try {
    await adjustExtraCredits(userId, "photo", BAD_REWARD.photo, "Thank-you for feedback (first Bad this month)");
    await adjustExtraCredits(userId, "live", BAD_REWARD.live, "Thank-you for feedback (first Bad this month)");
    return { rewarded: true };
  } catch (err) {
    // Couldn't add them: give the claim back so a later Bad can try again.
    await prisma.feedback.update({ where: { id: row.id }, data: { rewardPeriod: null } }).catch(() => {});
    throw err;
  }
}
