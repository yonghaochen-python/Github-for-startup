/**
 * The landing page A/B test: which brings more sign-ups from new visitors to "/"?
 *   A — shopping, with the female model: "Before you buy it, see how it works with everything you already own."
 *   B — your wardrobe, with the male model: "Your closet has more outfits in it than you think."
 * Both use the live welcome page's layout and buttons (components/landing). Signed-out visitors get A or B at random
 * and keep getting the same one. Note: each page has its own model, so a winner may be the person as much as the idea.
 * Each browser is counted once per step: saw the page, tapped Try It Free, tapped Create Account; sign-ups are counted
 * on the server from the cookie. Nothing personal is recorded: the cookie holds only "a" or "b", and the events have
 * no account or visitor id.
 *
 * To stop the test, set LANDING_TEST_ON to false: everyone sees the regular welcome page again.
 */
export const LANDING_TEST_ON = true;

export const LANDING_VARIANTS = ["a", "b"] as const;
export type LandingVariant = (typeof LANDING_VARIANTS)[number];

/** "men" is no longer used (the pages have no Women | Men switch); kept so old counts still read. */
export const LANDING_STEPS = ["view", "try", "create", "men"] as const;
export type LandingStep = (typeof LANDING_STEPS)[number];

/** Remembers which landing page this browser was shown (60 days), so a sign-up that follows is counted for it. */
export const LANDING_COOKIE = "virm_landing";
export const LANDING_COOKIE_DAYS = 60;

export const isLandingVariant = (v: unknown): v is LandingVariant => v === "a" || v === "b";

export type LandingEventName = `landing_${LandingStep | "signup"}_${LandingVariant}`;
export const landingEvent = (step: LandingStep | "signup", variant: LandingVariant) => `landing_${step}_${variant}` as LandingEventName;
