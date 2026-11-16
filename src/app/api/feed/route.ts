import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { feedPage } from "@/lib/posts";

/**
 * Anyone: the outfit feed, 10 posts at a time (?cursor= the last post's id; ?q= a search; ?tab=following for people
 * you follow). No AI, nothing paid.
 */
export async function GET(request: Request) {
  const viewer = await getCurrentUser(request).catch(() => null);
  const params = new URL(request.url).searchParams;
  return NextResponse.json(await feedPage(viewer, params.get("cursor"), params.get("q"), params.get("tab") === "following"), { headers: { "cache-control": "private, no-store" } });
}
