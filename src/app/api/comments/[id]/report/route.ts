import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { reportComment } from "@/lib/social";
import { track } from "@/lib/analytics";

/** A signed-in person reports a comment (once). Several reports hide it until an admin reviews it. */
export async function POST(request: Request, ctx: RouteContext<"/api/comments/[id]/report">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const result = await reportComment(id, user.id, body.reason);
  if (result === "reason") return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  if (result === "missing") return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (result === "own") return NextResponse.json({ error: "That's your own comment." }, { status: 400 });
  if (result === "ok") await track(user.id, "comment_reported");
  return NextResponse.json({ ok: true });
}
