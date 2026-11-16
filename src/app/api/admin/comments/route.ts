import { NextResponse } from "next/server";
import { asResponse, requireAdmin } from "@/lib/auth";
import { commentQueue, reviewComment } from "@/lib/social";

const noStore = { "cache-control": "private, no-store" };

/** Admin: comments waiting for review (hidden after reports, or with open reports). */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  return NextResponse.json({ queue: await commentQueue() }, { headers: noStore });
}

/** Admin review: { commentId, action: "restore" | "remove" | "dismiss" }. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { commentId?: unknown; action?: unknown };
  const ok = typeof body.commentId === "string" && (await reviewComment(body.commentId, body.action));
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
