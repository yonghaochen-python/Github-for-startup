import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingEnabled, customerFor, stripe } from "@/lib/billing";
import { track } from "@/lib/analytics";

const noStore = { "cache-control": "private, no-store" };

/**
 * Start the 7-day Plus trial: after the person ticks the terms, opens Stripe's checkout in "setup" mode, which saves a
 * card and charges $0 (it cannot charge). The trial itself starts only when Stripe confirms the card was saved
 * (see /api/billing/webhook), never from the browser.
 */
export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { accepted?: unknown };
  if (body.accepted !== true) return NextResponse.json({ error: "Please confirm the trial terms first." }, { status: 400, headers: noStore });

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, trialStartedAt: true } });
  if (!account) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  if (account.trialStartedAt) return NextResponse.json({ error: "You've already had your free trial.", code: "already_used" }, { status: 409, headers: noStore });
  const subscribed = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ["active", "past_due", "incomplete", "unpaid"] } }, select: { id: true } });
  if (subscribed) return NextResponse.json({ error: "You're already on Plus.", code: "subscribed" }, { status: 409, headers: noStore });

  try {
    const origin = new URL(request.url).origin;
    const customer = await customerFor({ id: user.id, email: account.email });
    const session = await stripe().checkout.sessions.create({
      mode: "setup",
      customer,
      currency: "usd",
      // Cards only, so each has a fingerprint for the one-trial-per-card check.
      allowed_payment_method_types: ["card"],
      success_url: `${origin}/trial?done=1`,
      cancel_url: `${origin}/trial?canceled=1`,
      metadata: { userId: user.id, purpose: "trial" },
      setup_intent_data: { metadata: { userId: user.id, purpose: "trial" } },
      custom_text: { submit: { message: "$0 today. Your card is saved, not charged. No automatic charge when your 7-day trial ends." } },
    });
    await track(user.id, "trial_checkout_started");
    return NextResponse.json({ url: session.url }, { headers: noStore });
  } catch (err) {
    console.error("Couldn't start the trial checkout:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't open the secure card page right now. Please try again." }, { status: 502, headers: noStore });
  }
}
