import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, sessionCookieHeader, devSignedOutCookieHeader } from "@/lib/auth";
import { SAMPLE_CLOSET } from "@/lib/sampleCloset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const email = body && typeof body === "object" && "email" in body ? String(body.email).trim().toLowerCase() : "";
  const password = body && typeof body === "object" && "password" in body ? String(body.password) : "";

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
  const user = await prisma.user.create({ data: { email, passwordHash } });
  await prisma.clothingItem.createMany({
    data: SAMPLE_CLOSET.map((item) => ({ ...item, userId: user.id })),
  });
  const { cookie, expiresAt } = await createSession(user.id);

  const response = NextResponse.json({ user: { email: user.email } }, { status: 201 });
  response.headers.append("set-cookie", sessionCookieHeader(cookie, expiresAt));
  const devCookie = devSignedOutCookieHeader(false);
  if (devCookie) response.headers.append("set-cookie", devCookie);
  return response;
}
