import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { postsBy } from "@/lib/posts";
import { normalizeUsername } from "@/lib/profiles";

/** Anyone: a profile's published posts, newest first. */
export async function GET(request: Request, ctx: RouteContext<"/api/profiles/[username]/posts">) {
  const { username } = await ctx.params;
  const viewer = await getCurrentUser(request).catch(() => null);
  const posts = await postsBy(normalizeUsername(decodeURIComponent(username)), viewer);
  return NextResponse.json({ posts }, { headers: { "cache-control": "private, no-store" } });
}
