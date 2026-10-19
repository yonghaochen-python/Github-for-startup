import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createResetToken } from "@/lib/passwordReset";

const noStore = { "cache-control": "private, no-store" };

/**
 * Admins only: a one-time link the owner can give to someone locked out of their account. The person opens it and
 * picks their own new password; the admin never sees or sets it. Returns the link's secret once.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Enter the account's email." }, { status: 400, headers: noStore });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "No account uses that email." }, { status: 404, headers: noStore });

  const { token, expiresAt } = await createResetToken(user.id);
  return NextResponse.json({ token, expiresAt }, { headers: noStore });
}
