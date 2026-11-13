import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserPost, createPost, POSTS_PER_DAY, postsToday, type ItemPictures, type NewPost } from "@/lib/posts";
import { track } from "@/lib/analytics";

const noStore = { "cache-control": "private, no-store" };

/** Publish an outfit post: form fields "picture" (prepared on the device) and "data" (JSON: caption, tags, items). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  if (!(await canUserPost(user))) return NextResponse.json({ error: "Posting isn't open yet." }, { status: 403, headers: noStore });
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } });
  if (!me?.username) return NextResponse.json({ error: "Pick a username first.", code: "needs_username" }, { status: 409, headers: noStore });
  if ((await postsToday(user.id)) >= POSTS_PER_DAY) {
    return NextResponse.json({ error: `That's ${POSTS_PER_DAY} posts today. Try again tomorrow.` }, { status: 429, headers: noStore });
  }
  const form = await request.formData().catch(() => null);
  const picture = form?.get("picture");
  if (!(picture instanceof File)) return NextResponse.json({ error: "Add a photo." }, { status: 400, headers: noStore });
  let data: NewPost = {};
  try {
    data = JSON.parse(String(form?.get("data") ?? "{}")) as NewPost;
  } catch {
    return NextResponse.json({ error: "Something was wrong with the post." }, { status: 400, headers: noStore });
  }
  try {
    // Store pieces' own pictures arrive as "itemPicture-<position>".
    const itemPictures: ItemPictures = new Map();
    for (const [name, value] of form?.entries() ?? []) {
      const m = /^itemPicture-(\d{1,2})$/.exec(name);
      if (m && value instanceof File) itemPictures.set(Number(m[1]), value);
    }
    const id = await createPost(user.id, picture, data, itemPictures);
    await track(user.id, "post_created");
    return NextResponse.json({ id }, { status: 201, headers: noStore });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't post that." }, { status: 400, headers: noStore });
  }
}
