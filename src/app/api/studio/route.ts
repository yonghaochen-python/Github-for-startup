import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { portraitInfo } from "@/lib/portrait";
import { generatingModules, latestReports } from "@/lib/studioReports";

/** The Studio home: the person's portrait (if any) and the newest report of each module. Nothing is generated. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const [portrait, reports, generating] = await Promise.all([portraitInfo(user.id), latestReports(user.id), generatingModules(user.id)]);
  return NextResponse.json({ portrait, reports, generating }, { headers: { "cache-control": "no-store" } });
}
