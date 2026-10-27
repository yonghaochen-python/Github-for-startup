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
  /** Clothing photos a typical user adds per month (each is tagged by Claude). */
  closetPhotos: number;
  /** "Style it" requests a typical user makes per month (each asks Claude for 3 outfits). */
  styleIts: number;
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
  /** Claude cost of tagging one clothing photo (find the pieces, then check the crops), USD. */
  claudePerClosetPhoto: number;
  /** Claude cost of one "Style it" request (3 outfit ideas from the closet), USD. */
  claudePerStyleIt: number;
  /** Any other AI cost per user per month, USD. */
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
    free: { label: "Free", price: 0, fee: 0, photos: 4, lives: 1, closetPhotos: 3, styleIts: 3 },
    plus: { label: "Plus", price: 14.99, fee: 0.84, photos: 100, lives: 10, closetPhotos: 10, styleIts: 15 },
    pro: { label: "Pro", price: 24.99, fee: 1.2, photos: 100, lives: 30, closetPhotos: 15, styleIts: 30 },
  },
  packs: [
    { id: "live-5", kind: "live", credits: 5, price: 2.99, fee: 0.39, sold: 0 },
    // Fee estimated the same way as the others: about 2.9% + 30¢.
    { id: "live-15", kind: "live", credits: 15, price: 7.99, fee: 0.53, sold: 0 },
    { id: "photo-20", kind: "photo", credits: 20, price: 1.99, fee: 0.36, sold: 0 },
    { id: "photo-60", kind: "photo", credits: 60, price: 4.99, fee: 0.44, sold: 0 },
  ],
  // FLUX VTO v2 on the BFL API. BFL doesn't publish this model's price (1 credit = $0.01); confirm in the BFL dashboard.
  photoCost: 0.04,
  // Decart charges about $0.02 a second; a full 20-second session is about $0.40.
  liveCost: 0.4,
  // Claude Sonnet 5 ($2 / $10 per million input / output tokens), estimated from the app's prompts and image sizes:
  // a clothing photo is ~1,600 image + ~700 prompt tokens in and ~1,500 out (incl. thinking), plus a crop check;
  // "Style it" is the closet as text (~3,000 tokens) in and ~2,300 out.
  claudePerClosetPhoto: 0.03,
  claudePerStyleIt: 0.03,
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
