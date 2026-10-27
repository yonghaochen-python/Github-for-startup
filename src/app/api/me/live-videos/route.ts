import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { MAX_VIDEOS, MAX_VIDEO_BYTES, VIDEO_TYPES, listLiveVideos, looksLikeVideo, saveLiveVideo } from "@/lib/liveVideos";

const noStore = { "cache-control": "private, no-store" };

/** The signed-in person's saved live try-on videos (newest first). */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  return NextResponse.json({ videos: await listLiveVideos(user.id) }, { headers: noStore });
}

/**
 * "Save to Virm" for a live try-on replay: stores the video privately for its owner. Only on an explicit click.
 * Admin-only for now, like Live itself.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("video");
  if (!(file instanceof File)) return NextResponse.json({ error: "No video to save." }, { status: 400, headers: noStore });
  const type = file.type.split(";")[0];
  const ext = VIDEO_TYPES[type];
  if (!ext) return NextResponse.json({ error: "That video type can't be saved." }, { status: 400, headers: noStore });
  if (file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "That video is too large to save." }, { status: 413, headers: noStore });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeVideo(bytes, ext)) return NextResponse.json({ error: "That file isn't a video." }, { status: 400, headers: noStore });
  if ((await listLiveVideos(user.id)).length >= MAX_VIDEOS) {
    return NextResponse.json({ error: `You have ${MAX_VIDEOS} saved videos. Delete one in Saved Looks to save another.` }, { status: 409, headers: noStore });
  }
  const id = await saveLiveVideo(user.id, bytes, type);
  return NextResponse.json({ id }, { headers: noStore });
}
