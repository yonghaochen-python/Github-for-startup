import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { MONTH_RE, closetFor, readMonth } from "@/lib/planner";

const noStore = { "cache-control": "no-store" };

/** A month's plan (?month=2026-11): each day's closet piece ids and who set it. Pieces since deleted are left out. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Choose a month." }, { status: 400, headers: noStore });
  const closet = await closetFor(user.id);
  const days = await readMonth(user.id, month, new Set(closet.map((p) => p.id)));
  return NextResponse.json({ month, days: days ?? {}, saved: days !== null }, { headers: noStore });
}
