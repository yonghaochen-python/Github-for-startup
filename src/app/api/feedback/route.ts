import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { FEEDBACK_KINDS, FeedbackError, ratingFor, submitFeedback, type FeedbackKind } from "@/lib/feedback";

const noStore = { "cache-control": "no-store" };

/** Saves a rating of one of the person's results (and, for the month's first real Bad, a thank-you). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { kind?: unknown; targetId?: unknown; rating?: unknown };
  const kind = (FEEDBACK_KINDS as readonly unknown[]).includes(body.kind) ? (body.kind as FeedbackKind) : null;
  const targetId = typeof body.targetId === "string" && /^[\w-]{6,100}$/.test(body.targetId) ? body.targetId : null;
  const rating = kind ? ratingFor(kind, body.rating) : null;
  if (!kind || !targetId || !rating) return NextResponse.json({ error: "Nothing to rate." }, { status: 400, headers: noStore });

  try {
    const { rewarded } = await submitFeedback(user.id, kind, targetId, rating);
    return NextResponse.json({ ok: true, rewarded }, { headers: noStore });
  } catch (err) {
    if (err instanceof FeedbackError) return NextResponse.json({ error: err.message }, { status: 404, headers: noStore });
    console.error("Feedback failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500, headers: noStore });
  }
}
