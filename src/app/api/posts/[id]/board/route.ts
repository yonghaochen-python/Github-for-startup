import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { getBoard } from "@/lib/posts";

/** Only the person who posted it: the editor layout behind the post (null if it was never opened in the editor). */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]/board">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const found = await getBoard(id, user.id);
  return NextResponse.json({ board: found?.board ?? null }, { headers: { "cache-control": "private, no-store" } });
}
