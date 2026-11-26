import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { isLandingVariant, LANDING_STEPS, LANDING_TEST_ON, landingEvent, type LandingStep } from "@/lib/landingTest";

/**
 * Landing page A/B test: one step by a signed-out visitor (saw the page, tapped Try It Free, tapped Create Account).
 * Only the step and "a" or "b" are recorded, with no account or visitor id. The browser sends each step once.
 */
export async function POST(request: Request) {
  if (!LANDING_TEST_ON) return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => ({}))) as { variant?: unknown; step?: unknown };
  if (isLandingVariant(body.variant) && LANDING_STEPS.includes(body.step as LandingStep)) {
    await track(null, landingEvent(body.step as LandingStep, body.variant));
  }
  return new NextResponse(null, { status: 204 });
}
