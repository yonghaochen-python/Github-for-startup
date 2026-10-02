import { NextResponse } from "next/server";
import { createSession, devSignedOutCookieHeader, getOrCreateDevUser, isDevMode, sessionCookieHeader } from "@/lib/auth";

// Local development only: passwordless sign-in as the demo account. Hard-refuses in production.
export async function POST() {
  if (!isDevMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const user = await getOrCreateDevUser();
  const { cookie, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ user: { email: user.email } });
  response.headers.append("set-cookie", sessionCookieHeader(cookie, expiresAt));
  const devCookie = devSignedOutCookieHeader(false);
  if (devCookie) response.headers.append("set-cookie", devCookie);
  return response;
}
