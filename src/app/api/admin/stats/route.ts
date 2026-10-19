import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { computeAdminStats } from "@/lib/adminStats";

const noStore = { "cache-control": "private, no-store" };
const MAX_RANGE_DAYS = 366;

/** Owner dashboard totals for a date range (?from=YYYY-MM-DD&to=YYYY-MM-DD, UTC). Admins only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }

  const params = new URL(request.url).searchParams;
  const now = new Date();
  const to = params.get("to") ? new Date(`${params.get("to")}T23:59:59.999Z`) : now;
  const from = params.get("from") ? new Date(`${params.get("from")}T00:00:00Z`) : new Date(now.getTime() - 29 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400, headers: noStore });
  }
  if ((to.getTime() - from.getTime()) / 86400000 > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Choose a range of one year or less." }, { status: 400, headers: noStore });
  }

  try {
    return NextResponse.json({ stats: await computeAdminStats(from, to > now ? now : to) }, { headers: noStore });
  } catch (err) {
    console.error("Admin stats failed:", err);
    return NextResponse.json({ error: "Couldn't load the statistics right now." }, { status: 500, headers: noStore });
  }
}
