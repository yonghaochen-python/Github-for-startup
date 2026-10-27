import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { settleCredit } from "@/lib/credits";

const noStore = { "cache-control": "private, no-store" };

/**
 * The page reports how a live session went: "connected" counts its reserved credit, "failed" (before connecting)
 * gives it back. Only a still-reserved credit changes, so repeated or late reports do nothing. Admin-only, like Live.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown; outcome?: unknown };
  if (typeof body.sessionId !== "string" || !/^live-[0-9a-f-]{36}$/.test(body.sessionId) || (body.outcome !== "connected" && body.outcome !== "failed")) {
    return NextResponse.json({ error: "Bad report." }, { status: 400, headers: noStore });
  }
  const changed = await settleCredit(user.id, body.sessionId, body.outcome === "connected" ? "completed" : "released", body.outcome);
  return NextResponse.json({ ok: true, changed }, { headers: noStore });
}
