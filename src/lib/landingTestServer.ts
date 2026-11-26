import { readCookie } from "@/lib/picks";
import { isLandingVariant, LANDING_COOKIE, type LandingVariant } from "@/lib/landingTest";

/** The landing page a new account's browser was shown, if any (read at sign-up). Server only. */
export function landingVariantFrom(request: Request): LandingVariant | null {
  const v = readCookie(request, LANDING_COOKIE);
  return isLandingVariant(v) ? v : null;
}
