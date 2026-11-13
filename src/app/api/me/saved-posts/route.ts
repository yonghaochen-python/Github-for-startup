import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { savedPosts } from "@/lib/posts";

/** Your saved posts (Saved → Inspiration). */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  return NextResponse.json({ posts: await savedPosts(user) }, { headers: { "cache-control": "private, no-store" } });
}
