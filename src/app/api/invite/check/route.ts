import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { billingEnabled } from "@/lib/billing";
import { normalizeCode } from "@/lib/invites";

/** Is this a real invite code? (For the /join page, so a mistyped link says so before sign-up.) */
export async function GET(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ valid: false, code: null });
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  const found = code ? await prisma.user.findUnique({ where: { inviteCode: code }, select: { id: true } }) : null;
  return NextResponse.json({ valid: Boolean(found), code }, { headers: { "cache-control": "private, no-store" } });
}
