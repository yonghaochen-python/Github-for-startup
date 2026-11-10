import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { claimEvent, finishEvent, fingerprintHash, stripe, verifyWebhook } from "@/lib/billing";
import { startTrial } from "@/lib/trial";

/**
 * Stripe's messages to Virm. Each one is checked against the webhook secret (so only Stripe can send them) and
 * handled once by its event id (a repeated delivery changes nothing). Plus access and the trial start only from
 * these verified messages, never from anything a browser sends.
 */
export async function POST(request: Request) {
  let event: Stripe.Event;
  try {
    event = await verifyWebhook(await request.text(), request.headers.get("stripe-signature"));
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (!(await claimEvent(event))) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "setup" && session.metadata?.purpose === "trial") {
        const outcome = await trialCardSaved(session);
        await finishEvent(event.id, outcome.outcome, outcome.userId);
        return NextResponse.json({ received: true });
      }
    }
    await finishEvent(event.id, "ignored");
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`Stripe event ${event.type} failed:`, message);
    await finishEvent(event.id, `error: ${message}`);
    // A 500 makes Stripe deliver it again later (handled events are never redone).
    return NextResponse.json({ error: "Not handled." }, { status: 500 });
  }
}

/** A card was saved for the trial: start it (once per account), noting a protected hash of the card's fingerprint. */
async function trialCardSaved(session: Stripe.Checkout.Session): Promise<{ outcome: string; userId: string | null }> {
  const userId = session.metadata?.userId ?? null;
  if (!userId) return { outcome: "ignored: no account", userId: null };
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  // The session must belong to this account's own Stripe customer.
  if (!user || !customerId || user.stripeCustomerId !== customerId) return { outcome: "ignored: customer mismatch", userId };

  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  let fingerprint: string | null = null;
  if (setupIntentId) {
    const intent = await stripe().setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
    const method = intent.payment_method && typeof intent.payment_method !== "string" ? intent.payment_method : null;
    fingerprint = method?.card?.fingerprint ?? null;
  }
  const started = await startTrial(userId, fingerprintHash(fingerprint));
  return { outcome: started.started ? `trial started${fingerprint ? "" : " (no fingerprint)"}` : "ignored: trial already used", userId };
}
