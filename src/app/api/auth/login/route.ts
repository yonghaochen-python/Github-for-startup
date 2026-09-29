import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, sessionCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const email = body && typeof body === "object" && "email" in body ? String(body.email).trim().toLowerCase() : "";
  const password = body && typeof body === "object" && "password" in body ? String(body.password) : "";

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const { cookie, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ user: { email: user.email } });
  response.headers.set("set-cookie", sessionCookieHeader(cookie, expiresAt));
  return response;
}
