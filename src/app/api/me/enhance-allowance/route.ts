import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { enhanceAllowance } from "@/lib/enhanceAllowance";

/** Signed in: how many new AI enhancements are left this month (null = no limit). */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  return NextResponse.json(await enhanceAllowance(user.id), { headers: { "cache-control": "private, no-store" } });
}
