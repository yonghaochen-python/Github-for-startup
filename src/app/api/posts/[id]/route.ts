import { NextResponse } from "next/server";
import { asResponse, getCurrentUser, requireUser } from "@/lib/auth";
import { deletePost, getPost } from "@/lib/posts";

/** Anyone: one published post (its owner and admins also see it while it's hidden for review). */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser(request).catch(() => null);
  const post = await getPost(id, viewer);
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ post }, { headers: { "cache-control": "private, no-store" } });
}

/** Its owner (or an admin): delete the post and its pictures. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  if (!(await deletePost(id, user))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
