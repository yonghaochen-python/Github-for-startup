import { NextResponse } from "next/server";
import { isDevMode } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
    devLogin: isDevMode(),
    tryOnLive: (process.env.TRYON_PROVIDER ?? "mock") !== "mock",
    // Live Try On's real-time preview (Decart) is only on where a Decart key is set: the local demo, not the live site.
    liveTryOn: Boolean(process.env.DECART_API_KEY),
  });
}
