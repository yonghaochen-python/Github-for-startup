import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { feedPage } from "@/lib/posts";

/** Anyone: the outfit feed, 10 posts at a time (?cursor= the last post's id). No AI, nothing paid. */
export async function GET(request: Request) {
  const viewer = await getCurrentUser(request).catch(() => null);
  const cursor = new URL(request.url).searchParams.get("cursor");
  return NextResponse.json(await feedPage(viewer, cursor), { headers: { "cache-control": "private, no-store" } });
}
