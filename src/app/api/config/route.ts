import { NextResponse } from "next/server";
import { isDevMode } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY), devLogin: isDevMode() });
}
