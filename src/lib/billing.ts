import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/**
 * Stripe, on the server only (keys never reach a browser). Virm stores only Stripe's ids (customer, subscription)
 * and a keyed hash of a card's fingerprint; card details live with Stripe.
 *
 * The 7-day trial saves a card with Checkout in "setup" mode, which cannot charge anything. A charge only ever
 * happens when the person later confirms a Plus subscription on Stripe's own checkout page.
 *
 * BILLING_ENABLED=1 turns the trial and subscription screens on; without it, every billing route answers "not found".
 */

export const billingEnabled = () => process.env.BILLING_ENABLED === "1" && Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe isn't set up.");
  client ??= new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return client;
}

/** Checks a Stripe webhook's signature and returns the event (throws if it isn't genuinely from Stripe). */
export async function verifyWebhook(body: string, signature: string | null): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("unsigned");
  return stripe().webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
}

/** The person's Stripe customer, made once (Stripe's own duplicate guard plus a "only if still empty" save). */
export async function customerFor(user: { id: string; email: string }): Promise<string> {
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (row?.stripeCustomerId) return row.stripeCustomerId;
  const customer = await stripe().customers.create({ email: user.email, metadata: { userId: user.id } }, { idempotencyKey: `virm-customer-${user.id}` });
  await prisma.user.updateMany({ where: { id: user.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } });
  const saved = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  return saved?.stripeCustomerId ?? customer.id;
}

/**
 * A keyed one-way hash of Stripe's card fingerprint (never the fingerprint itself). Two trials with the same card get
 * the same hash, which only flags them for an admin to look at; it can't be turned back into anything.
 */
export function fingerprintHash(fingerprint: string | null | undefined): string | null {
  const secret = process.env.TRIAL_FINGERPRINT_SECRET;
  if (!fingerprint || !secret) return null;
  return createHmac("sha256", secret).update(fingerprint).digest("hex");
}

/**
 * Records a webhook event once by Stripe's event id. Returns false when it was already handled (a repeated
 * delivery), so it's never processed twice; an earlier attempt that failed is tried again.
 */
export async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const existing = await prisma.billingEvent.findUnique({ where: { id: event.id }, select: { outcome: true } });
  if (existing && existing.outcome && !existing.outcome.startsWith("error")) return false;
  if (!existing) {
    try {
      await prisma.billingEvent.create({ data: { id: event.id, type: event.type } });
    } catch {
      return false; // Another delivery of the same event got here first.
    }
  }
  return true;
}

export async function finishEvent(id: string, outcome: string, userId: string | null = null): Promise<void> {
  await prisma.billingEvent.update({ where: { id }, data: { outcome: outcome.slice(0, 200), userId, processedAt: new Date() } }).catch(() => {});
}
