import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteLiveVideo, isVideoId, liveVideoKey } from "@/lib/liveVideos";

const noStore = { "cache-control": "private, no-store" };
const notFound = () => NextResponse.json({ error: "Video not found." }, { status: 404, headers: noStore });

/**
 * Plays (or, with ?download=1, downloads) one of the signed-in person's saved live videos. Supports byte ranges,
 * which Safari needs to play video at all.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/me/live-videos/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const { id } = await ctx.params;
  if (!isVideoId(id)) return notFound();
  const key = liveVideoKey(user.id, id);
  const head = await env.UPLOADS.head(key);
  if (!head) return notFound();

  const size = head.size;
  const headers: Record<string, string> = {
    ...noStore,
    "content-type": head.httpMetadata?.contentType ?? "video/mp4",
    "accept-ranges": "bytes",
  };
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers["content-disposition"] = `attachment; filename="virm-live-try-on-${id.slice(0, 13)}.${id.split(".").pop()}"`;
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    const part = await env.UPLOADS.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!part) return notFound();
    return new Response(part.body, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }

  const object = await env.UPLOADS.get(key);
  if (!object) return notFound();
  return new Response(object.body, { headers: { ...headers, "content-length": String(size) } });
}

/** Deletes one of the signed-in person's saved live videos. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/me/live-videos/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const { id } = await ctx.params;
  if (!isVideoId(id)) return notFound();
  await deleteLiveVideo(user.id, id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
