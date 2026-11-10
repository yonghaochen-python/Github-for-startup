import { prisma } from "@/lib/prisma";

/**
 * Usage events for the owner's analytics dashboard. An event is only a name, success/failure, an optional
 * duration and the time — never photos, clothing details, emails or error text. Recording can never break the
 * feature being measured: failures here are swallowed.
 */
export type EventName =
  | "signup"
  | "login"
  | "outfit_generate"
  /** A Style it search was started (counted for the daily limit). */
  | "outfit_request"
  | "tryon"
  | "tryon_reused"
  | "clothes_detect"
  | "clothes_added"
  | "look_saved"
  | "pick_created"
  | "pick_opened"
  | "pick_vote"
  | "signup_from_pick"
  /** Real AI cost of Claude calls (costMicros set): adding clothes, Style it, an outfit's explanation. */
  | "ai_cost_closet"
  | "ai_cost_style_it"
  | "ai_cost_explain"
  /** AI clothing enhancement (FLUX 3): exact when BFL reports the cost; _est when it didn't (the set rate is used). */
  | "ai_cost_enhance"
  | "ai_cost_enhance_est"
  /** An enhancement shown again from its kept copy (free). */
  | "enhance_reused"
  /** Free reuse: a saved Style it search shown again, an AI Stylist report reopened (once an hour). */
  | "style_it_reused"
  | "report_opened"
  /** Free: a Planner month or day made (no AI). */
  | "planner_generated"
  /** Photo try-on was down on Virm's side (the try-on service's balance ran out, or its key was rejected). */
  | "tryon_service_down"
  /** Billing: the trial's secure card page was opened. */
  | "trial_checkout_started"
  /** Billing: the Plus payment page was opened (after the final confirmation). */
  | "plus_checkout_started"
  /** Billing: a monthly Plus payment failed (Stripe retries it). */
  | "plus_payment_failed"
  | `visit_${"home" | "shop" | "closet" | "studio" | "stylist" | "tryon" | "saved" | "profile" | "planner"}`;

export async function track(
  userId: string | null,
  name: EventName,
  details: { ok?: boolean; durationMs?: number; costMicros?: number } = {}
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId,
        name,
        ok: details.ok ?? true,
        durationMs: details.durationMs != null ? Math.round(details.durationMs) : null,
        costMicros: details.costMicros != null ? Math.round(details.costMicros) : null,
      },
    });
  } catch (err) {
    console.error("Couldn't record analytics event:", err);
  }
}

/** Measures how long `work` takes and records success or failure, then returns (or rethrows) its result. */
export async function trackTimed<T>(userId: string, name: EventName, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await work();
    await track(userId, name, { ok: true, durationMs: Date.now() - startedAt });
    return result;
  } catch (err) {
    await track(userId, name, { ok: false, durationMs: Date.now() - startedAt });
    throw err;
  }
}

/** Records a section visit at most once per person per section per hour. */
export async function trackVisit(userId: string, section: string): Promise<void> {
  const name = `visit_${section}` as EventName;
  const recent = await prisma.analyticsEvent
    .findFirst({ where: { userId, name, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }, select: { id: true } })
    .catch(() => null);
  if (!recent) await track(userId, name);
}

/** Records what a request's Claude calls really cost (nothing when no call was made, e.g. practice mode). */
export async function trackAiCost(userId: string, name: "ai_cost_closet" | "ai_cost_style_it" | "ai_cost_explain", meter: { costMicros: number; inputTokens: number }, ok = true) {
  if (!meter.inputTokens) return;
  await track(userId, name, { ok, costMicros: meter.costMicros });
}

/** Records a free reuse at most once per person per hour (so reopening a page repeatedly isn't counted many times). */
export async function trackOncePerHour(userId: string, name: EventName): Promise<void> {
  const recent = await prisma.analyticsEvent
    .findFirst({ where: { userId, name, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }, select: { id: true } })
    .catch(() => null);
  if (!recent) await track(userId, name);
}
