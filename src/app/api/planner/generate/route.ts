import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { MONTH_RE, aroundMonth, closetFor, readMonth, saveMonth, tasteFor, todayFrom } from "@/lib/planner";
import { planMonth } from "@/lib/planOutfits";

const noStore = { "cache-control": "no-store" };

/**
 * Generate Plan for a month (free: no AI). This month: today on; a future month: every day; a past month: nothing.
 * Days the person chose or edited, and days already past, are kept. When the month already has a plan, nothing is
 * replaced unless `replace` is true (the page asks first).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { month?: unknown; today?: unknown; replace?: unknown };
  const month = typeof body.month === "string" ? body.month : "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "Choose a month." }, { status: 400, headers: noStore });
  const today = todayFrom(body.today);
  if (month < today.slice(0, 7)) return NextResponse.json({ error: "That month has passed." }, { status: 400, headers: noStore });

  const closet = await closetFor(user.id);
  const ids = new Set(closet.map((p) => p.id));
  const existing = await readMonth(user.id, month, ids);
  const from = month === today.slice(0, 7) ? today : `${month}-01`;
  const replacing = existing && Object.entries(existing).some(([date, day]) => date >= from && day.source === "generated");
  if (replacing && body.replace !== true) return NextResponse.json({ exists: true }, { status: 409, headers: noStore });

  const [taste, around] = await Promise.all([tasteFor(user.id), aroundMonth(user.id, month, ids)]);
  const { days, ranOut } = planMonth(month, from, closet, taste, existing ?? {}, around);
  if (!Object.keys(days).length) {
    return NextResponse.json({ error: "Add a top, a bottom and shoes (or a dress) to My Closet first." }, { status: 400, headers: noStore });
  }
  await saveMonth(user.id, month, days);
  return NextResponse.json({ month, days, ranOut }, { headers: noStore });
}
