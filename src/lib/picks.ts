import { randomBytes } from "node:crypto";
import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import type { ImageBytes } from "@/lib/tryOn/types";

/**
 * "Help me pick": two try-on pictures shared by link so friends can vote A or B, no account needed.
 * The pictures are copied to private/picks/<pickId>/ (the link opens them, nothing else does) and deleted when
 * the pick ends: 48 hours after it's made, or earlier if the owner ends it.
 */

export const PICK_HOURS = 48;
/** How many open picks one person can have at once. */
export const MAX_OPEN_PICKS = 10;
export const PICK_IMAGES = ["a", "b", "card"] as const;
export type PickImage = (typeof PICK_IMAGES)[number];

const pickPrefix = (pickId: string) => `private/picks/${pickId}/`;

/** A long random code for the share link: unguessable, so the link itself is the key. */
export function newPickCode(): string {
  return randomBytes(18).toString("base64url");
}

export async function savePickImage(pickId: string, which: PickImage, image: ImageBytes): Promise<void> {
  await env.UPLOADS.put(`${pickPrefix(pickId)}${which}`, image.bytes, { httpMetadata: { contentType: image.mediaType } });
}

export async function loadPickImage(pickId: string, which: PickImage): Promise<ImageBytes | null> {
  const object = await env.UPLOADS.get(`${pickPrefix(pickId)}${which}`);
  if (!object) return null;
  return { bytes: new Uint8Array(await object.arrayBuffer()), mediaType: object.httpMetadata?.contentType ?? "image/jpeg" };
}

async function deletePickImages(pickIds: string[]): Promise<void> {
  const keys = pickIds.flatMap((id) => PICK_IMAGES.map((which) => `${pickPrefix(id)}${which}`));
  for (let i = 0; i < keys.length; i += 1000) await env.UPLOADS.delete(keys.slice(i, i + 1000));
}

/** Ends picks for good: pictures first, then the picks and their votes. */
export async function deletePicks(pickIds: string[]): Promise<void> {
  if (pickIds.length === 0) return;
  await deletePickImages(pickIds);
  await prisma.pick.deleteMany({ where: { id: { in: pickIds } } });
}

/** Removes picks whose 48 hours are up. Runs alongside pick requests, so ended picks never linger long. */
export async function deleteEndedPicks(): Promise<void> {
  try {
    const ended = await prisma.pick.findMany({ where: { expiresAt: { lte: new Date() } }, select: { id: true }, take: 50 });
    await deletePicks(ended.map((p) => p.id));
  } catch (err) {
    console.error("Couldn't clean up ended picks:", err);
  }
}

/** Everything a person's picks keep, for account deletion. */
export async function deleteAllPicks(userId: string): Promise<void> {
  const picks = await prisma.pick.findMany({ where: { userId }, select: { id: true } });
  await deletePicks(picks.map((p) => p.id));
}

/** An open pick by its link code, or null when there's no such pick or its time is up. */
export async function findOpenPick(code: string) {
  if (!/^[\w-]{16,64}$/.test(code)) return null;
  const pick = await prisma.pick.findUnique({ where: { code }, include: { user: { select: { displayName: true } } } });
  if (!pick || pick.expiresAt <= new Date()) return null;
  return pick;
}

/** The cookie that remembers a friend's browser, so each browser votes once per pick. */
export const VOTER_COOKIE = "virm_voter";
/** Set when someone arrives from a pick link, so a sign-up that follows can be counted as coming from a pick. */
export const FROM_PICK_COOKIE = "virm_from_pick";

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
