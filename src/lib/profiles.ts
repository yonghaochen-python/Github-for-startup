import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { BIO_MAX_CHARS } from "@/lib/profileRules";

/**
 * Public profiles (social feed). Only what the person chose to make public is ever shown: @username, display name,
 * bio and profile picture. Never the email, closet, try-on photo or anything else.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const BIO_MAX = BIO_MAX_CHARS;
/** The profile picture: a small square, prepared on the device. */
export const AVATAR_MAX_BYTES = 600 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
/** Stored at the top level (served publicly by /uploads/<key>), apart from closet pictures and private photos. */
const AVATAR_PREFIX = "profile-";

/** Words that look official or clash with pages, so nobody can pretend to be Virm. */
const RESERVED = new Set([
  "admin", "administrator", "virm", "virmapp", "official", "support", "help", "staff", "team", "moderator", "mod",
  "root", "system", "api", "app", "www", "login", "signup", "join", "trial", "plus", "pro", "pricing", "settings",
  "profile", "explore", "feed", "for-you", "following", "trending", "create", "post", "posts", "saved", "studio",
  "closet", "shop", "stylist", "planner", "about", "terms", "privacy", "contact", "null", "undefined", "me", "you",
]);

/** Lowercase, trimmed, "@" taken off. */
export const normalizeUsername = (value: unknown) => (typeof value === "string" ? value.trim().replace(/^@+/, "").toLowerCase() : "");

/** Why this username can't be used (null when it's fine). Doesn't check whether it's taken. */
export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9._]+$/.test(name)) return "Only letters, numbers, . and _";
  if (!/^[a-z]/.test(name)) return "Start with a letter.";
  if (/[._]$/.test(name) || /[._]{2}/.test(name)) return "No . or _ at the end or twice in a row.";
  if (RESERVED.has(name) || RESERVED.has(name.replace(/[._]/g, ""))) return "That name is reserved.";
  return null;
}

/** Whether someone else already has it (case doesn't matter: usernames are stored in lowercase). */
export async function usernameTaken(name: string, exceptUserId?: string): Promise<boolean> {
  const row = await prisma.user.findUnique({ where: { username: name }, select: { id: true } });
  return Boolean(row && row.id !== exceptUserId);
}

/** A bio as typed: no control characters, single spaces and line breaks, at most BIO_MAX characters. Empty = none. */
export function cleanBio(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, BIO_MAX)
    .trim();
  return cleaned || null;
}

export const avatarUrl = (key: string | null | undefined) => (key ? `/uploads/${key}` : null);

/** Saves a new profile picture (replacing the old one) and returns its key. */
export async function saveAvatar(userId: string, file: File): Promise<string> {
  const ext = AVATAR_TYPES[file.type];
  if (!ext) throw new Error("Use a JPG, PNG or WebP picture.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That picture is too large.");
  const key = `${AVATAR_PREFIX}${randomUUID()}.${ext}`;
  await env.UPLOADS.put(key, new Uint8Array(await file.arrayBuffer()), { httpMetadata: { contentType: file.type } });
  const old = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: userId }, data: { avatarKey: key } });
  if (old?.avatarKey) await env.UPLOADS.delete(old.avatarKey).catch(() => {});
  return key;
}

/** Removes the profile picture (also used when the account is deleted). */
export async function deleteAvatar(userId: string): Promise<void> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  if (!row?.avatarKey) return;
  await env.UPLOADS.delete(row.avatarKey).catch(() => {});
  await prisma.user.update({ where: { id: userId }, data: { avatarKey: null } });
}

export type PublicProfile = { username: string; displayName: string | null; bio: string | null; avatarUrl: string | null; joined: string };

/** What anyone may see about a username (null when there's no such profile). */
export async function publicProfile(username: string): Promise<PublicProfile | null> {
  const name = normalizeUsername(username);
  if (!name) return null;
  const row = await prisma.user.findUnique({
    where: { username: name },
    select: { username: true, displayName: true, bio: true, avatarKey: true, createdAt: true },
  });
  if (!row?.username) return null;
  return { username: row.username, displayName: row.displayName, bio: row.bio, avatarUrl: avatarUrl(row.avatarKey), joined: row.createdAt.toISOString() };
}
