import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing";
import { inviteCodeFor, invitedCount, redeemInviteCode } from "@/lib/invites";
import { track } from "@/lib/analytics";

const noStore = { "cache-control": "private, no-store" };

/** Your invite code (made the first time), its share link, and how many friends joined with it. */
export async function GET(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const code = await inviteCodeFor(user.id);
  const url = `${new URL(request.url).origin}/join?code=${encodeURIComponent(code)}`;
  return NextResponse.json({ code, url, joined: await invitedCount(user.id) }, { headers: noStore });
}

/** Use a friend's code before your trial starts, so it will be the 14-day trial. */
export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const result = await redeemInviteCode(user.id, body.code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400, headers: noStore });
  await track(user.id, "invite_code_used");
  return NextResponse.json({ ok: true }, { headers: noStore });
}
