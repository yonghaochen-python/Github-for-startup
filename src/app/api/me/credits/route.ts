import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/credits";

/** The signed-in person's plan, monthly period and photo/live balances (the same numbers the server uses). */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  return NextResponse.json({ balances: await getBalances(user.id) }, { headers: { "cache-control": "private, no-store" } });
}
