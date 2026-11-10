import { NextResponse } from "next/server";
import { MAX_LIVE_SECONDS } from "@/lib/aiCosts";
import { createDecartClient } from "@decartai/sdk";
import { randomUUID } from "node:crypto";
import { asResponse, requireUser } from "@/lib/auth";
import { accountPlan, limitMessage, liveUsesToday, reserveCredit, settleCredit } from "@/lib/credits";
import { TRIAL_LIVE_PER_DAY } from "@/lib/plans";

/**
 * Live Try On (preview): a short-lived Decart token for one real-time session, so the permanent key never reaches
 * the browser. For any signed-in person, and off unless DECART_API_KEY is set. Each token can only run the try-on
 * model, only from this site, for at most MAX_SESSION_SECONDS (Decart ends the session itself).
 *
 * Every session is billed, so the limits always stop people here (not just counted): the plan's monthly live
 * sessions, at most SESSIONS_PER_DAY a person a day, and at most SITE_SESSIONS_PER_DAY for everyone together
 * (admins aside), all worked out from the credit records in the database.
 */

const MAX_SESSION_SECONDS = MAX_LIVE_SECONDS;
const SESSIONS_PER_DAY = 3;
/** Caps the whole site's Decart spend per day: about 50 × 20 s × $0.02 ≈ $20 at most. */
const SITE_SESSIONS_PER_DAY = 50;
const MODEL = "lucy-vton-latest";
const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Live try-on isn't connected." }, { status: 503, headers: noStore });

  const admin = user.role === "admin";
  if (!admin) {
    // During the 7-day trial, live try-on is at most one session a day (checked here, on the server).
    const { trial } = await accountPlan(user.id);
    const perDay = trial ? TRIAL_LIVE_PER_DAY : SESSIONS_PER_DAY;
    const [mine, everyone] = await Promise.all([liveUsesToday(user.id), liveUsesToday()]);
    if (mine >= perDay) {
      const error = trial
        ? `During your trial, live try-on is ${perDay} session a day. Try again tomorrow.`
        : `That's ${perDay} live sessions today. Try again tomorrow.`;
      return NextResponse.json({ error }, { status: 429, headers: noStore });
    }
    if (everyone >= SITE_SESSIONS_PER_DAY) {
      return NextResponse.json({ error: "Live try-on is busy today. Try again tomorrow." }, { status: 429, headers: noStore });
    }
  }

  // One live credit is reserved for this session; the page reports whether the stream connected (counted) or failed
  // before connecting (given back) through /api/live/session. With no report it stays reserved, since Decart may
  // have billed the session.
  const sessionId = `live-${randomUUID()}`;
  const reservation = await reserveCredit(user, "live", sessionId, { block: true, trial: { kind: "live" } });
  if (!reservation.ok) return NextResponse.json({ error: limitMessage("live", reservation), code: "no_credits" }, { status: 402, headers: noStore });

  try {
    const client = createDecartClient({ apiKey, telemetry: false });
    const token = await client.tokens.create({
      expiresIn: 60,
      allowedModels: [MODEL],
      allowedOrigins: [new URL(request.url).origin],
      constraints: { realtime: { maxSessionDuration: MAX_SESSION_SECONDS } },
    });
    return NextResponse.json({ apiKey: token.apiKey, model: MODEL, maxSeconds: MAX_SESSION_SECONDS, sessionId }, { headers: noStore });
  } catch (err) {
    await settleCredit(user.id, sessionId, "released", "token_failed").catch(() => {});
    console.error("Couldn't create a Decart token:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't start live try-on right now." }, { status: 502, headers: noStore });
  }
}
