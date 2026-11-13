import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { isReportReason, reportPost } from "@/lib/posts";
import { track } from "@/lib/analytics";

/** A signed-in person reports a post (once per post). Several reports hide it until an admin reviews it. */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[id]/report">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown; note?: unknown };
  if (!isReportReason(body.reason)) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  const result = await reportPost(id, user.id, body.reason, body.note);
  if (result === "missing") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (result === "own") return NextResponse.json({ error: "That's your own post." }, { status: 400 });
  if (result === "ok") await track(user.id, "post_reported");
  // A repeated report is accepted quietly (nothing changes).
  return NextResponse.json({ ok: true });
}
