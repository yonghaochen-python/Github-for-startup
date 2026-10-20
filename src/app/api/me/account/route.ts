import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookieHeader, requireUser, verifyPassword } from "@/lib/auth";
import { deleteAccount } from "@/lib/accountDeletion";

const noStore = { "cache-control": "private, no-store" };

/** Deletes the signed-in account for good, after the person confirms with their password. */
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 403, headers: noStore });
  }

  try {
    await deleteAccount(user.id);
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json({ error: "Couldn't delete your account right now. Please try again." }, { status: 500, headers: noStore });
  }
  const response = NextResponse.json({ ok: true }, { headers: noStore });
  response.headers.append("set-cookie", clearSessionCookieHeader());
  return response;
}
