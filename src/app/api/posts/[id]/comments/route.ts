import { NextResponse } from "next/server";
import { asResponse, getCurrentUser, requireUser } from "@/lib/auth";
import { addComment, listComments } from "@/lib/social";
import { track } from "@/lib/analytics";

const noStore = { "cache-control": "private, no-store" };

/** Anyone: a post's comments (oldest first). */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]/comments">) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser(request).catch(() => null);
  const comments = await listComments(id, viewer);
  if (!comments) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  return NextResponse.json({ comments }, { headers: noStore });
}

/** Signed in (and allowed to post, with a username): add a comment ({ body }). */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[id]/comments">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  const result = await addComment(id, user, body.body);
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status, headers: noStore });
  await track(user.id, "comment_created");
  return NextResponse.json(result, { status: 201, headers: noStore });
}
