import { NextResponse } from "next/server";
import { asResponse, getCurrentUser, requireUser } from "@/lib/auth";
import { deletePost, getPost, readPostForm, updatePost } from "@/lib/posts";

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

/**
 * Only the person who posted it: edit the post (form fields as when posting; "picture" and "board" only when they
 * changed). Nobody can edit someone else's post, admins included.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const noStore = { "cache-control": "private, no-store" };
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Something was wrong with the changes." }, { status: 400, headers: noStore });
  let parsed;
  try {
    parsed = readPostForm(form);
  } catch {
    return NextResponse.json({ error: "Something was wrong with the changes." }, { status: 400, headers: noStore });
  }
  const picture = form.get("picture");
  try {
    const ok = await updatePost(id, user.id, picture instanceof File ? picture : null, parsed.data, parsed.itemPictures, parsed.board);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save that." }, { status: 400, headers: noStore });
  }
}
