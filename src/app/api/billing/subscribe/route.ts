import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingEnabled, customerFor, OPEN_STATUSES, stripe } from "@/lib/billing";
import { track } from "@/lib/analytics";

const noStore = { "cache-control": "private, no-store" };

/**
 * Continue with Plus ($14.99/month): only after the person ticks the final confirmation, opens Stripe's checkout for
 * the subscription. Stripe shows the price again and takes the payment there; Plus starts when Stripe confirms it
 * (see /api/billing/webhook). Nothing here charges anyone by itself.
 */
export async function POST(request: Request) {
  const priceId = process.env.STRIPE_PLUS_PRICE_ID;
  if (!billingEnabled() || !priceId) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { confirmed?: unknown };
  if (body.confirmed !== true) return NextResponse.json({ error: "Please confirm first." }, { status: 400, headers: noStore });

  const open = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: OPEN_STATUSES } }, select: { id: true } });
  if (open) return NextResponse.json({ error: "You're already on Plus.", code: "subscribed" }, { status: 409, headers: noStore });
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!account) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });

  try {
    const origin = new URL(request.url).origin;
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: await customerFor({ id: user.id, email: account.email }),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/plus?done=1`,
      cancel_url: `${origin}/plus?canceled=1`,
      metadata: { userId: user.id, purpose: "plus" },
      subscription_data: { metadata: { userId: user.id } },
      // Checkout links expire after 30 minutes, so an old tab can't start a second subscription later.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    await track(user.id, "plus_checkout_started");
    return NextResponse.json({ url: session.url }, { headers: noStore });
  } catch (err) {
    console.error("Couldn't start the Plus checkout:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't open the secure payment page right now. Please try again." }, { status: 502, headers: noStore });
  }
}
