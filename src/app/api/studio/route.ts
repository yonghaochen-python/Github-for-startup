import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { portraitInfo } from "@/lib/portrait";
import { generatingModules, latestReports, styleProfileFor } from "@/lib/studioReports";

/** The AI Stylist home: the portrait (if any), the newest report of each module, and the Style Profile. Nothing is generated. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const [portrait, reports, generating, profile] = await Promise.all([
    portraitInfo(user.id),
    latestReports(user.id),
    generatingModules(user.id),
    styleProfileFor(user.id),
  ]);
  return NextResponse.json({ portrait, reports, generating, profile }, { headers: { "cache-control": "no-store" } });
}
