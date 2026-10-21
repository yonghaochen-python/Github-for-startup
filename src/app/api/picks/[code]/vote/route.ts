import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOpenPick, pickCounts, pickLabels, readCookie, VOTER_COOKIE } from "@/lib/picks";

const noStore = { "cache-control": "private, no-store" };

/** A friend's vote for one of the looks, once per browser. Returns the totals so they can see how it's going. */
export async function POST(request: Request, ctx: RouteContext<"/api/picks/[code]/vote">) {
  const { code } = await ctx.params;
  const pick = await findOpenPick(code);
  if (!pick) return NextResponse.json({ error: "These looks aren't shared anymore." }, { status: 404, headers: noStore });
  const lookCount = pickLabels(pick).length;

  const body = (await request.json().catch(() => ({}))) as { choice?: unknown };
  const choice = typeof body.choice === "number" && Number.isInteger(body.choice) && body.choice >= 0 && body.choice < lookCount ? body.choice : null;
  if (choice === null) return NextResponse.json({ error: "Choose one of the looks." }, { status: 400, headers: noStore });

  const viewer = await getCurrentUser(request).catch(() => null);
  if (viewer?.id === pick.userId) {
    return NextResponse.json({ error: "These are your looks. Share the link so friends can vote." }, { status: 403, headers: noStore });
  }
  const voterId = readCookie(request, VOTER_COOKIE);
  if (!voterId) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400, headers: noStore });

  const existing = await prisma.pickVote.findUnique({ where: { pickId_voterId: { pickId: pick.id, voterId } }, select: { choice: true } });
  if (!existing) {
    try {
      await prisma.pickVote.create({ data: { pickId: pick.id, voterId, choice } });
      await track(viewer?.id ?? null, "pick_vote");
    } catch {
      // A second tap racing the first: the first vote stands.
    }
  }
  return NextResponse.json({ counts: await pickCounts(pick.id, lookCount), myVote: existing?.choice ?? choice }, { headers: noStore });
}
