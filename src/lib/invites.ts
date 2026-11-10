import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Invite codes. Every account can share its own code (VIRM- and 5 letters/numbers, made the first time it's shown).
 * Someone who signs up with a friend's code, or enters it before their trial starts, gets the 14-day Plus trial
 * (see trialTerms). A code is used once per new account, and never your own. Nothing is given to the sharer.
 */

/** Letters and numbers that can't be mixed up when typed (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const newCode = () => `VIRM-${Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/** Tidies what someone typed: capitals, no spaces, and "VIRM-" added if they left it off. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("VIRM") ? raw.slice(4) : raw;
  return /^[A-Z0-9]{5}$/.test(body) ? `VIRM-${body}` : null;
}

/** This account's code, made once (a clash with another account's code just tries a new one). */
export async function inviteCodeFor(userId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { inviteCode: true } });
    if (!row) throw new Error("No such account.");
    if (row.inviteCode) return row.inviteCode;
    await prisma.user.updateMany({ where: { id: userId, inviteCode: null }, data: { inviteCode: newCode() } }).catch(() => {});
  }
  throw new Error("Couldn't make an invite code.");
}

export type InviteResult = { ok: true } | { ok: false; error: string };

/**
 * Links this account to the friend whose code it is, so its trial will be the 14-day one. Only once, only before the
 * trial starts, and not with your own code.
 */
export async function redeemInviteCode(userId: string, input: unknown): Promise<InviteResult> {
  const code = normalizeCode(input);
  if (!code) return { ok: false, error: "That code doesn't look right. It looks like VIRM-K7Q2X." };
  const [me, friend] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { invitedById: true, trialStartedAt: true } }),
    prisma.user.findUnique({ where: { inviteCode: code }, select: { id: true } }),
  ]);
  if (!me) return { ok: false, error: "Not found." };
  if (!friend) return { ok: false, error: "We couldn't find that code. Check it with your friend." };
  if (friend.id === userId) return { ok: false, error: "That's your own code. Share it with a friend instead." };
  if (me.invitedById) return me.invitedById === friend.id ? { ok: true } : { ok: false, error: "You've already used a friend's code." };
  if (me.trialStartedAt) return { ok: false, error: "Your trial has already started, so a code can't change it." };
  const { count } = await prisma.user.updateMany({ where: { id: userId, invitedById: null, trialStartedAt: null }, data: { invitedById: friend.id } });
  return count ? { ok: true } : { ok: false, error: "You've already used a friend's code." };
}

/** How many people joined with this account's code. */
export const invitedCount = (userId: string) => prisma.user.count({ where: { invitedById: userId } });
