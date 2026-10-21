import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOpenPick, readCookie, VOTER_COOKIE } from "@/lib/picks";

const noStore = { "cache-control": "private, no-store" };

/** A friend's vote: A or B, once per browser. Returns the totals so they can see how it's going. */
export async function POST(request: Request, ctx: RouteContext<"/api/picks/[code]/vote">) {
  const { code } = await ctx.params;
  const pick = await findOpenPick(code);
  if (!pick) return NextResponse.json({ error: "These looks aren't shared anymore." }, { status: 404, headers: noStore });

  const body = (await request.json().catch(() => ({}))) as { choice?: unknown };
  const choice = body.choice === "a" || body.choice === "b" ? body.choice : null;
  if (!choice) return NextResponse.json({ error: "Choose A or B." }, { status: 400, headers: noStore });

  const viewer = await getCurrentUser(request).catch(() => null);
  if (viewer?.id === pick.userId) {
    return NextResponse.json({ error: "These are your looks. Share the link so friends can vote." }, { status: 403, headers: noStore });
  }
  const voterId = readCookie(request, VOTER_COOKIE);
  if (!voterId) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400, headers: noStore });

  const existing = await prisma.pickVote.findUnique({ where: { pickId_voterId: { pickId: pick.id, voterId } }, select: { choice: true } });
  let totals = { votesA: pick.votesA, votesB: pick.votesB };
  if (!existing) {
    try {
      await prisma.pickVote.create({ data: { pickId: pick.id, voterId, choice } });
      totals = await prisma.pick.update({
        where: { id: pick.id },
        data: choice === "a" ? { votesA: { increment: 1 } } : { votesB: { increment: 1 } },
        select: { votesA: true, votesB: true },
      });
      await track(viewer?.id ?? null, "pick_vote");
    } catch {
      // A second tap racing the first: the first vote stands.
    }
  }
  return NextResponse.json({ ...totals, myVote: existing?.choice ?? choice }, { headers: noStore });
}
