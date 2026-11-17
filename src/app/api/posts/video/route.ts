import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { canUserPost } from "@/lib/posts";
import { discardVideo, uploadPostVideo } from "@/lib/postVideo";

const noStore = { "cache-control": "private, no-store" };

/**
 * People who may post: send a post's video (the raw file as the body, with its Content-Type), before posting it.
 * Returns { key } for the post. Stored as is: no conversion, nothing paid.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  if (!(await canUserPost(user))) return NextResponse.json({ error: "Posting isn't open yet." }, { status: 403, headers: noStore });
  const result = await uploadPostVideo(user.id, request);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  return NextResponse.json(result, { status: 201, headers: noStore });
}

/** Throws away a sent video that didn't become a post (?key=). Only your own, and only if no post uses it. */
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  await discardVideo(user.id, key);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
