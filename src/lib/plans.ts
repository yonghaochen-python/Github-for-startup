/**
 * The plans' allowances: the one place they're set. The credit system (server-side limits), Profile's counters, the
 * Pricing page, the admin cost calculator and the tests all read from here.
 */

export type PlanKey = "free" | "plus" | "pro";
/** What a monthly allowance counts: photo try-ons, live try-ons, clothing photos tagged by AI, Style It searches. */
export type CreditKind = "photo" | "live" | "closet" | "style";
/** What the 7-day trial counts (AI Stylist reports have their own trial allowance; otherwise they use photo credits). */
export type TrialKind = "photo" | "live" | "report" | "closet" | "style";

export const PLAN_KEYS: PlanKey[] = ["free", "plus", "pro"];
export const CREDIT_KINDS: CreditKind[] = ["photo", "live", "closet", "style"];
export const TRIAL_KINDS: TrialKind[] = ["photo", "live", "report", "closet", "style"];

/** Monthly allowances. Each kind is separate (clothing photos and Style It never use try-on credits). */
export const PLAN_ALLOWANCES: Record<PlanKey, Record<CreditKind, number>> = {
  free: { photo: 10, live: 2, closet: 30, style: 10 },
  plus: { photo: 60, live: 15, closet: 150, style: 60 },
  // Pro is hidden; its try-on numbers are kept, and the new kinds match Plus until Pro comes back.
  pro: { photo: 100, live: 30, closet: 150, style: 60 },
};

/** The 7-day Plus trial: exact allowances (never unlimited), kept apart from every monthly and extra credit. */
export const TRIAL_DAYS = 7;
export const TRIAL_ALLOWANCES: Record<TrialKind, number> = { photo: 15, live: 3, report: 4, closet: 40, style: 20 };
/** Live try-on during a trial: at most this many sessions a day (checked on the server). */
export const TRIAL_LIVE_PER_DAY = 1;

export const PLAN_NAMES: Record<PlanKey, string> = { free: "Free", plus: "Plus", pro: "Pro" };

/** How each kind is named in counters and messages ("15 photo try-ons", "30 clothing photos"). */
export const KIND_NAMES: Record<TrialKind, string> = {
  photo: "photo try-ons",
  live: "live try-ons",
  report: "AI Stylist reports",
  closet: "clothing photos",
  style: "Style It searches",
};

export const isPlanKey = (v: unknown): v is PlanKey => v === "free" || v === "plus" || v === "pro";
export const isCreditKind = (v: unknown): v is CreditKind => v === "photo" || v === "live" || v === "closet" || v === "style";
