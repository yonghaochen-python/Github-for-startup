import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { matchPost } from "@/lib/postMatch";

/** Signed in: the post's pieces with the closest piece in your own closet for each (free, no AI). */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]/match">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const pieces = await matchPost(id, user);
  if (!pieces) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ pieces }, { headers: { "cache-control": "private, no-store" } });
}
