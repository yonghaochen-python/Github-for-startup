import { NextResponse } from "next/server";
import { publicProfile } from "@/lib/profiles";

/** Anyone (signed in or not): the public part of a profile. Nothing else about the account is ever returned. */
export async function GET(_request: Request, ctx: RouteContext<"/api/profiles/[username]">) {
  const { username } = await ctx.params;
  const profile = await publicProfile(decodeURIComponent(username));
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ profile }, { headers: { "cache-control": "public, max-age=60" } });
}
