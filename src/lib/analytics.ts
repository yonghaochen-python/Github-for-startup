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
  | "tryon"
  | "clothes_detect"
  | "clothes_added"
  | "look_saved"
  | "pick_created"
  | "pick_opened"
  | "pick_vote"
  | "signup_from_pick"
  | `visit_${"home" | "closet" | "studio" | "stylist" | "tryon" | "saved" | "profile"}`;

export async function track(
  userId: string | null,
  name: EventName,
  details: { ok?: boolean; durationMs?: number } = {}
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: { userId, name, ok: details.ok ?? true, durationMs: details.durationMs != null ? Math.round(details.durationMs) : null },
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
