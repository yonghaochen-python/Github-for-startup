import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { landingEvent } from "@/lib/landingTest";
import { landingVariantFrom } from "@/lib/landingTestServer";
import { prisma } from "@/lib/prisma";
import { createSession, devSignedOutCookieHeader, hashPassword, randomToken, sessionCookieHeader } from "@/lib/auth";
import { SAMPLE_CLOSET } from "@/lib/sampleCloset";
import { cleanDisplayName } from "@/lib/displayName";
import { FROM_PICK_COOKIE, readCookie } from "@/lib/picks";
import { redeemInviteCode } from "@/lib/invites";
import { billingEnabled } from "@/lib/billing";
import { clearGoogleCookie, finishSignIn, readPending, sameState } from "@/lib/googleSignIn";

/**
 * Back from Google. The same Google account always opens the same Virm account: found by Google's id, or (the first
 * time) by the email Google has verified, which links it; otherwise a new account is made, just like signing up with an
 * email (sample closet, invite code, counted as a sign-up). It has no password; one can be set with "Forgot password".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (message: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));
    response.headers.append("set-cookie", clearGoogleCookie());
    return response;
  };

  const pending = readPending(request);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return fail("Google sign-in was cancelled.");
  if (!pending || !state || !code || !(await sameState(state, pending.state))) return fail("That sign-in link expired. Please try again.");

  let profile;
  try {
    profile = await finishSignIn(request, code, pending.verifier);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Google sign-in didn't work. Please try again.");
  }

  let user = await prisma.user.findUnique({ where: { googleSub: profile.sub }, select: { id: true } });
  let created = false;
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true, googleSub: true } });
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== profile.sub) return fail("This email is linked to a different Google account.");
      await prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: profile.sub } });
      user = { id: byEmail.id };
    } else {
      const made = await prisma.user.create({
        data: {
          email: profile.email,
          passwordHash: await hashPassword(randomToken()),
          displayName: cleanDisplayName(profile.name) ?? null,
          googleSub: profile.sub,
        },
        select: { id: true },
      });
      await prisma.clothingItem.createMany({ data: SAMPLE_CLOSET.map((item) => ({ ...item, userId: made.id })) });
      user = made;
      created = true;
    }
  }

  const { cookie, expiresAt } = await createSession(user.id);
  const fromPick = created && readCookie(request, FROM_PICK_COOKIE) !== null;
  if (created) {
    await track(user.id, "signup");
    if (pending.invite && billingEnabled() && (await redeemInviteCode(user.id, pending.invite)).ok) await track(user.id, "signup_with_invite");
    if (fromPick) await track(user.id, "signup_from_pick");
    const landing = landingVariantFrom(request);
    if (landing) await track(user.id, landingEvent("signup", landing));
  } else {
    await track(user.id, "login");
  }

  const response = NextResponse.redirect(new URL(pending.next, url.origin));
  response.headers.append("set-cookie", sessionCookieHeader(cookie, expiresAt));
  response.headers.append("set-cookie", clearGoogleCookie());
  if (fromPick) response.headers.append("set-cookie", `${FROM_PICK_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  const devCookie = devSignedOutCookieHeader(false);
  if (devCookie) response.headers.append("set-cookie", devCookie);
  response.headers.set("cache-control", "no-store");
  return response;
}
