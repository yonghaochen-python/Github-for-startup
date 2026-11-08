import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { settleCredit } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { MAX_LIVE_SECONDS } from "@/lib/aiCosts";

const noStore = { "cache-control": "private, no-store" };

/**
 * The page reports how a live session went: "connected" counts its reserved credit, "failed" (before connecting)
 * gives it back. Only a still-reserved credit changes, so repeated or late reports do nothing. For signed-in people, like Live.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown; outcome?: unknown; seconds?: unknown };
  if (typeof body.sessionId !== "string" || !/^live-[0-9a-f-]{36}$/.test(body.sessionId) || !["connected", "failed", "ended"].includes(String(body.outcome))) {
    return NextResponse.json({ error: "Bad report." }, { status: 400, headers: noStore });
  }
  // "ended": how many seconds the connected session ran, noted once on its counted credit (for the real cost on the
  // admin dashboard; Decart charges by the second). Capped at the session limit.
  if (body.outcome === "ended") {
    const seconds = Math.max(0, Math.min(MAX_LIVE_SECONDS, Math.round(Number(body.seconds) || 0)));
    const noted = await prisma.creditEntry.updateMany({
      where: { userId: user.id, requestId: body.sessionId, kind: "live", status: "completed", note: null },
      data: { note: `seconds:${seconds}` },
    });
    return NextResponse.json({ ok: true, changed: noted.count > 0 }, { headers: noStore });
  }
  const changed = await settleCredit(user.id, body.sessionId, body.outcome === "connected" ? "completed" : "released", body.outcome as string);
  return NextResponse.json({ ok: true, changed }, { headers: noStore });
}
