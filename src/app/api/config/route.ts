import { NextResponse } from "next/server";
import { getCurrentUser, isDevMode } from "@/lib/auth";
import { googleSignInOn } from "@/lib/googleSignIn";

export async function GET(request: Request) {
  const user = await getCurrentUser(request).catch(() => null);
  return NextResponse.json({
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
    devLogin: isDevMode(),
    // "Continue with Google" shows only where Google sign-in is set up.
    googleSignIn: googleSignInOn(),
    tryOnLive: (process.env.TRYON_PROVIDER ?? "mock") !== "mock",
    // Live Try On's real-time AI (Decart): only where a Decart key is set, for anyone signed in.
    liveTryOn: Boolean(process.env.DECART_API_KEY) && Boolean(user),
  });
}
