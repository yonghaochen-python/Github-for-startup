import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { deleteComment } from "@/lib/social";

/** Whoever wrote it, the post's owner, or an admin: delete a comment. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/comments/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  if (!(await deleteComment(id, user))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
