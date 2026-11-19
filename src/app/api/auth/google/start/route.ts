import { NextResponse } from "next/server";
import { startSignIn } from "@/lib/googleSignIn";

/** "Continue with Google": off to Google, remembering where to come back to (and a friend's invite code, if typed). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const started = await startSignIn(request, url.searchParams.get("next") ?? "/", url.searchParams.get("invite") ?? "");
  if (!started) return NextResponse.redirect(new URL("/login?error=Google%20sign-in%20isn%27t%20available%20yet.", url.origin));
  const response = NextResponse.redirect(started.url);
  response.headers.append("set-cookie", started.cookie);
  response.headers.set("cache-control", "no-store");
  return response;
}
