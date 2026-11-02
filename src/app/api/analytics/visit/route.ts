import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackVisit } from "@/lib/analytics";

const SECTIONS = new Set(["home", "shop", "closet", "studio", "saved", "profile"]);

/** Notes that a signed-in person opened one of the main sections. Only the section name is recorded. */
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return new NextResponse(null, { status: 204 });
  const body = (await request.json().catch(() => ({}))) as { section?: unknown };
  if (typeof body.section === "string" && SECTIONS.has(body.section)) await trackVisit(user.id, body.section);
  return new NextResponse(null, { status: 204 });
}
