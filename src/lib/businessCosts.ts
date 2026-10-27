/**
 * Default assumptions for the admin Costs & break-even calculator (/admin/costs). Server only: they're imported by
 * that page's server component and sent to admins as props, so they never ship in the public app code. Every value
 * can be changed on the page; this file is just the starting point. All figures are monthly estimates.
 */

export type PlanKey = "free" | "plus" | "pro";

export type PlanAssumption = {
  label: string;
  /** Monthly price, USD. */
  price: number;
  /** Estimated payment processing fee per monthly payment, USD. */
  fee: number;
  /** Photo try-ons included per month. */
  photos: number;
  /** Live try-on sessions included per month. */
  lives: number;
};

export type PackAssumption = {
  id: string;
  kind: "photo" | "live";
  /** Try-ons in the pack. */
  credits: number;
  price: number;
  fee: number;
  /** Packs sold per month. */
  sold: number;
};

export type Scenario = { name: string; usage: number };

export type CostAssumptions = {
  plans: Record<PlanKey, PlanAssumption>;
  packs: PackAssumption[];
  /** Direct AI cost of one completed try-on, USD. */
  photoCost: number;
  liveCost: number;
  /** Any other AI cost per user per month (e.g. clothing tagging, outfit ideas), USD. */
  extraAiPerUser: number;
  users: Record<PlanKey, number>;
  /** Hosting and Cloudflare, per month. */
  hosting: number;
  /** Other business expenses, per month. */
  other: number;
  /** Share of each allowance actually used, in percent. */
  scenarios: Scenario[];
};

export const DEFAULT_COSTS: CostAssumptions = {
  plans: {
    free: { label: "Free", price: 0, fee: 0, photos: 4, lives: 1 },
    plus: { label: "Plus", price: 14.99, fee: 0.84, photos: 100, lives: 10 },
    pro: { label: "Pro", price: 24.99, fee: 1.2, photos: 100, lives: 30 },
  },
  packs: [
    { id: "live-5", kind: "live", credits: 5, price: 2.99, fee: 0.39, sold: 0 },
    // Fee estimated the same way as the others: about 2.9% + 30¢.
    { id: "live-15", kind: "live", credits: 15, price: 7.99, fee: 0.53, sold: 0 },
    { id: "photo-20", kind: "photo", credits: 20, price: 1.99, fee: 0.36, sold: 0 },
    { id: "photo-60", kind: "photo", credits: 60, price: 4.99, fee: 0.44, sold: 0 },
  ],
  photoCost: 0.04,
  // Decart charges about $0.02 a second; a full 20-second session is about $0.40.
  liveCost: 0.4,
  extraAiPerUser: 0,
  users: { free: 100, plus: 10, pro: 3 },
  hosting: 5,
  other: 0,
  scenarios: [
    { name: "Low usage", usage: 25 },
    { name: "Expected usage", usage: 50 },
    { name: "Heavy usage", usage: 100 },
  ],
};
