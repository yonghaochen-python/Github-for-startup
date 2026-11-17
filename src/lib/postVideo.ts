import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { POST_VIDEO_MAX_BYTES, POST_VIDEO_TYPES } from "@/lib/postRules";

/**
 * Video posts. The video is sent on its own, straight into storage (it's too big to hold in memory with the rest of
 * the post), as its own public copy "postvideo-<random>.<ext>", marked with who sent it. Posting then claims it.
 * Nothing is converted or processed (no paid video service): it plays as it was filmed.
 */

/** Video uploads a person may start a day (more than posts, for retries; protects storage). */
export const VIDEO_UPLOADS_PER_DAY = 20;
const KEY = /^postvideo-[0-9a-f-]{36}\.(mp4|mov|webm)$/;
export const isPostVideoKey = (key: unknown): key is string => typeof key === "string" && KEY.test(key);

/** True when the first bytes really look like an MP4/MOV ("ftyp" and other QuickTime boxes) or WebM file. */
function looksLikeVideo(bytes: Uint8Array, ext: "mp4" | "mov" | "webm"): boolean {
  if (ext === "webm") return bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const box = bytes.length >= 8 ? String.fromCharCode(...bytes.slice(4, 8)) : "";
  return box === "ftyp" || (ext === "mov" && ["moov", "wide", "mdat", "free", "skip"].includes(box));
}

export type VideoUpload = { key: string } | { error: string; status: number };

/** Stores a video sent as the request body (Content-Type and Content-Length required). */
export async function uploadPostVideo(userId: string, request: Request): Promise<VideoUpload> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = POST_VIDEO_TYPES[type];
  if (!ext) return { error: "Use an MP4, MOV or WebM video.", status: 415 };
  const size = Number(request.headers.get("content-length"));
  if (!(size > 0)) return { error: "That video couldn't be read.", status: 411 };
  if (size > POST_VIDEO_MAX_BYTES) return { error: "That video is over 50 MB.", status: 413 };
  if (!request.body) return { error: "That video couldn't be read.", status: 400 };
  const today = await prisma.analyticsEvent.count({ where: { userId, name: "post_video_uploaded", createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= VIDEO_UPLOADS_PER_DAY) return { error: "That's a lot of videos today. Try again tomorrow.", status: 429 };

  const key = `postvideo-${randomUUID()}.${ext}`;
  await env.UPLOADS.put(key, request.body, { httpMetadata: { contentType: type }, customMetadata: { owner: userId } });
  // Check it really is a video (by its first bytes), and throw it away if not.
  const head = await env.UPLOADS.get(key, { range: { offset: 0, length: 16 } });
  const bytes = head ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array();
  if (!looksLikeVideo(bytes, ext)) {
    await env.UPLOADS.delete(key).catch(() => {});
    return { error: "That file isn't a video we can use.", status: 415 };
  }
  await prisma.analyticsEvent.create({ data: { userId, name: "post_video_uploaded" } });
  return { key };
}

/** A sent video this person may attach to a post: theirs, and not already on a post. */
export async function canClaimVideo(userId: string, key: string): Promise<boolean> {
  if (!isPostVideoKey(key)) return false;
  const head = await env.UPLOADS.head(key);
  if (!head || head.customMetadata?.owner !== userId) return false;
  return !(await prisma.post.findFirst({ where: { videoKey: key }, select: { id: true } }));
}

/** Throws away a sent video that never became a post (posting failed or was cancelled). */
export async function discardVideo(userId: string, key: string): Promise<void> {
  if (await canClaimVideo(userId, key)) await env.UPLOADS.delete(key).catch(() => {});
}
