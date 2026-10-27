import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";

/**
 * Live try-on videos a person chose to "Save to Virm". Stored privately in the uploads bucket under
 * private/live/<userId>/ (the public /uploads route refuses private/ keys), readable only through
 * /api/me/live-videos/<id> by their owner. Nothing is saved without that explicit click; the database isn't used
 * (videos are listed straight from storage), and deleting the account deletes them all.
 */

const prefix = (userId: string) => `private/live/${userId}/`;

export const VIDEO_TYPES: Record<string, "mp4" | "webm"> = { "video/mp4": "mp4", "video/webm": "webm" };
/** A 20-second 720p recording is about 5–8 MB; this leaves room without allowing huge files. */
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
/** Saved videos per person, so storage can't grow without limit. */
export const MAX_VIDEOS = 20;

const ID_PATTERN = /^\d{13}-[0-9a-f-]{36}\.(mp4|webm)$/;
export const isVideoId = (id: string) => ID_PATTERN.test(id);

export type LiveVideo = { id: string; savedAt: string; size: number };

/** True when the bytes really start like an MP4 ("ftyp" box) or WebM (EBML header) file. */
export function looksLikeVideo(bytes: Uint8Array, ext: "mp4" | "webm"): boolean {
  if (ext === "mp4") return bytes.length > 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

export async function listLiveVideos(userId: string): Promise<LiveVideo[]> {
  const videos: LiveVideo[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.UPLOADS.list({ prefix: prefix(userId), cursor });
    for (const o of page.objects) videos.push({ id: o.key.slice(prefix(userId).length), savedAt: o.uploaded.toISOString(), size: o.size });
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return videos.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveLiveVideo(userId: string, bytes: Uint8Array, type: string): Promise<string> {
  const ext = VIDEO_TYPES[type];
  if (!ext) throw new Error(`Unsupported video type: ${type}`);
  const id = `${Date.now()}-${randomUUID()}.${ext}`;
  await env.UPLOADS.put(prefix(userId) + id, bytes, { httpMetadata: { contentType: type } });
  return id;
}

export function liveVideoKey(userId: string, id: string): string {
  return prefix(userId) + id;
}

export async function deleteLiveVideo(userId: string, id: string): Promise<void> {
  await env.UPLOADS.delete(prefix(userId) + id);
}

/** Deletes every saved live video of a person (used when the account is deleted). */
export async function deleteAllLiveVideos(userId: string): Promise<void> {
  const keys = (await listLiveVideos(userId)).map((v) => prefix(userId) + v.id);
  for (let i = 0; i < keys.length; i += 1000) await env.UPLOADS.delete(keys.slice(i, i + 1000));
}
