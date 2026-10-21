import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, sessionCookieHeader, devSignedOutCookieHeader } from "@/lib/auth";
import { SAMPLE_CLOSET } from "@/lib/sampleCloset";
import { cleanDisplayName } from "@/lib/displayName";
import { FROM_PICK_COOKIE, readCookie } from "@/lib/picks";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const email = body && typeof body === "object" && "email" in body ? String(body.email).trim().toLowerCase() : "";
  const password = body && typeof body === "object" && "password" in body ? String(body.password) : "";
  // Optional; the email remains the login.
  const displayName = body && typeof body === "object" && "displayName" in body ? cleanDisplayName(body.displayName) ?? null : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, displayName } });
  await prisma.clothingItem.createMany({
    data: SAMPLE_CLOSET.map((item) => ({ ...item, userId: user.id })),
  });
  const { cookie, expiresAt } = await createSession(user.id);
  await track(user.id, "signup");
  // Arrived from a friend's "Share looks" link: counts toward how many people that loop brings in.
  const fromPick = readCookie(request, FROM_PICK_COOKIE) !== null;
  if (fromPick) await track(user.id, "signup_from_pick");

  const response = NextResponse.json({ user: { email: user.email } }, { status: 201 });
  response.headers.append("set-cookie", sessionCookieHeader(cookie, expiresAt));
  if (fromPick) response.headers.append("set-cookie", `${FROM_PICK_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  const devCookie = devSignedOutCookieHeader(false);
  if (devCookie) response.headers.append("set-cookie", devCookie);
  return response;
}
