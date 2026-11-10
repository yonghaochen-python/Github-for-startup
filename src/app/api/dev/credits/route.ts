import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { asResponse, isDevMode, requireUser } from "@/lib/auth";
import { getBalances, limitMessage, reserveCredit, settleCredit, trialCoversReport } from "@/lib/credits";
import { isCreditKind, type TrialKind } from "@/lib/plans";

/**
 * LOCAL TESTING ONLY: uses one credit exactly the way the paid features do (same rules, same order), without calling
 * any AI, so limits can be tested for free. Answers "not found" everywhere except the local copy.
 * POST { kind: "photo" | "live" | "closet" | "style", trial?: TrialKind, note?: string, allowed?: boolean }
 */
export async function POST(request: Request) {
  if (!isDevMode()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; trial?: unknown; note?: unknown; allowed?: unknown };
  if (!isCreditKind(body.kind)) return NextResponse.json({ error: "Choose a kind." }, { status: 400 });
  const kind = body.kind;
  const requestId = `devtest-${randomUUID()}`;
  const note = typeof body.note === "string" ? body.note : undefined;
  // Reports: covered once per type, checked exactly as the AI Stylist does.
  const allowed = body.trial === "report" && note ? await trialCoversReport(user.id, note) : body.allowed !== false;
  const trial = typeof body.trial === "string" ? { kind: body.trial as TrialKind, note, allowed } : undefined;
  const reservation = await reserveCredit(user, kind, requestId, { block: kind === "live", trial });
  if (!reservation.ok) return NextResponse.json({ ok: false, message: limitMessage(kind, reservation), code: "no_credits" }, { status: 402 });
  await settleCredit(user.id, requestId, "completed");
  return NextResponse.json({ ok: true, source: reservation.source, trialUsedUp: reservation.trialUsedUp ?? false, balances: await getBalances(user.id) });
}
