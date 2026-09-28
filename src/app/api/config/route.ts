import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}
