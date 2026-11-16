import { NextResponse } from "next/server";
import { asResponse, getCurrentUser, requireUser } from "@/lib/auth";
import { followState, setFollow } from "@/lib/social";

const noStore = { "cache-control": "private, no-store" };

/** Anyone: follower and following counts, and (signed in) whether you follow them. */
export async function GET(request: Request, ctx: RouteContext<"/api/profiles/[username]/follow">) {
  const { username } = await ctx.params;
  const viewer = await getCurrentUser(request).catch(() => null);
  const state = await followState(decodeURIComponent(username), viewer);
  if (!state) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  return NextResponse.json(state, { headers: noStore });
}

/** Signed in: follow ({ follow: true }) or unfollow ({ follow: false }). */
export async function POST(request: Request, ctx: RouteContext<"/api/profiles/[username]/follow">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { username } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { follow?: unknown };
  const result = await setFollow(user.id, decodeURIComponent(username), body.follow === true);
  if (result === "missing") return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  if (result === "self") return NextResponse.json({ error: "That's you." }, { status: 400, headers: noStore });
  return NextResponse.json(result, { headers: noStore });
}
