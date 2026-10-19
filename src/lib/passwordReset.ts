import { prisma } from "@/lib/prisma";
import { hashPassword, randomToken, sha256Hex } from "@/lib/auth";

/** How long a reset link works. */
export const RESET_LINK_MINUTES = 60;
export const MIN_PASSWORD_LENGTH = 8;

/**
 * A new one-time reset link secret for this account. Earlier unused links stop working, and only a hash of the
 * secret is stored, so the link itself is shown once and can't be read back from the database.
 */
export async function createResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000);
  await prisma.passwordReset.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordReset.create({ data: { userId, tokenHash: await sha256Hex(token), expiresAt } });
  return { token, expiresAt };
}

/**
 * Sets a new password with a reset link's secret. The link works once; every device signed in to the account is
 * signed out, in case someone else had access.
 */
export async function resetPassword(token: string, newPassword: string): Promise<"ok" | "invalid"> {
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: await sha256Hex(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return "invalid";
  // Claim the link first, so it can't be used twice at the same moment.
  const claimed = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return "invalid";
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await prisma.session.deleteMany({ where: { userId: reset.userId } });
  return "ok";
}
