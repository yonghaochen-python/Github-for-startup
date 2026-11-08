import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { asResponse, requireUser } from "@/lib/auth";
import { DATE_RE, aroundMonth, closetFor, readMonth, saveMonth, tasteFor } from "@/lib/planner";
import { outfitFor, outfitKey, weekOf, type DaySource } from "@/lib/planOutfits";

const noStore = { "cache-control": "no-store" };

/**
 * One day of the Planner (free: no AI). Never touches any other day.
 * - `generate: true` suggests a new outfit for the date (not saved): not the one shown (`current`), and not another
 *   outfit in the same Monday–Sunday week.
 * - `items` + `source` saves that day ("chosen" = a kept suggestion, "edited" = changed by hand); `items: []` clears it.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { date?: unknown; generate?: unknown; current?: unknown; items?: unknown; source?: unknown };
  const date = typeof body.date === "string" ? body.date : "";
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "Choose a day." }, { status: 400, headers: noStore });
  const month = date.slice(0, 7);
  const closet = await closetFor(user.id);
  const ids = new Set(closet.map((p) => p.id));
  const listOf = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === "string" && ids.has(id)))].slice(0, 8) : []);
  const [days, around] = await Promise.all([readMonth(user.id, month, ids), aroundMonth(user.id, month, ids)]);
  const plan = days ?? {};

  if (body.generate === true) {
    const week = weekOf(date);
    const all = { ...around, ...plan };
    const avoid = new Set(Object.entries(all).filter(([d]) => d !== date && weekOf(d) === week).map(([, day]) => outfitKey(day.items)));
    const current = listOf(body.current);
    if (current.length) avoid.add(outfitKey(current));
    const uses = new Map<string, number>();
    for (const day of Object.values(plan)) for (const id of day.items) uses.set(id, (uses.get(id) ?? 0) + 1);
    const made = outfitFor(date, closet, await tasteFor(user.id), uses, avoid);
    if (!made.items.length) return NextResponse.json({ error: "Add more pieces to My Closet first." }, { status: 400, headers: noStore });
    await track(user.id, "planner_generated");
    return NextResponse.json({ items: made.items, ranOut: made.ranOut }, { headers: noStore });
  }

  const items = listOf(body.items);
  const source: DaySource = body.source === "chosen" ? "chosen" : "edited";
  if (items.length) plan[date] = { items, source };
  else delete plan[date];
  await saveMonth(user.id, month, plan);
  return NextResponse.json({ date, day: plan[date] ?? null }, { headers: noStore });
}
