import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { portraitInfo } from "@/lib/portrait";
import { latestReports } from "@/lib/studioReports";

/** The Studio home: the person's portrait (if any) and the newest report of each module. Nothing is generated. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const [portrait, reports] = await Promise.all([portraitInfo(user.id), latestReports(user.id)]);
  return NextResponse.json({ portrait, reports }, { headers: { "cache-control": "no-store" } });
}
