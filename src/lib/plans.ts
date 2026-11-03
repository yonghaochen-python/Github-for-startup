/**
 * The plans' monthly allowances: the one place they're set. The credit system, the Pricing page and the admin
 * cost calculator all read from here.
 */

export type PlanKey = "free" | "plus" | "pro";
export type CreditKind = "photo" | "live";

export const PLAN_KEYS: PlanKey[] = ["free", "plus", "pro"];

export const PLAN_ALLOWANCES: Record<PlanKey, Record<CreditKind, number>> = {
  // Free: room for a few that go wrong (and a Bad rating on a try-on adds more, once a month).
  free: { photo: 10, live: 2 },
  plus: { photo: 60, live: 15 },
  pro: { photo: 100, live: 30 },
};

export const PLAN_NAMES: Record<PlanKey, string> = { free: "Free", plus: "Plus", pro: "Pro" };

export const isPlanKey = (v: unknown): v is PlanKey => v === "free" || v === "plus" || v === "pro";
