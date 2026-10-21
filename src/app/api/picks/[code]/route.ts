import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteEndedPicks, deletePicks, findOpenPick, FROM_PICK_COOKIE, readCookie, VOTER_COOKIE } from "@/lib/picks";

const noStore = { "cache-control": "private, no-store" };

/**
 * A pick as its link shows it, open to anyone with the link. The first visit from a browser gets a random voter id
 * (so it can vote once) and, when nobody is signed in, a note that lets a sign-up be counted as coming from a pick.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/picks/[code]">) {
  const { code } = await ctx.params;
  await deleteEndedPicks();
  const pick = await findOpenPick(code);
  if (!pick) return NextResponse.json({ error: "This pick has ended." }, { status: 404, headers: noStore });

  const viewer = await getCurrentUser(request).catch(() => null);
  const isOwner = viewer?.id === pick.userId;
  let voterId = readCookie(request, VOTER_COOKIE);
  const firstVisit = !voterId;
  voterId ??= crypto.randomUUID();
  const myVote = isOwner
    ? null
    : ((await prisma.pickVote.findUnique({ where: { pickId_voterId: { pickId: pick.id, voterId } }, select: { choice: true } }))?.choice ?? null);

  const response = NextResponse.json(
    {
      pick: {
        labelA: pick.labelA,
        labelB: pick.labelB,
        votesA: pick.votesA,
        votesB: pick.votesB,
        expiresAt: pick.expiresAt,
        ownerName: pick.user.displayName,
      },
      isOwner,
      myVote,
    },
    { headers: noStore }
  );
  if (firstVisit) {
    response.headers.append("set-cookie", `${VOTER_COOKIE}=${voterId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 365}`);
    if (!isOwner) await track(viewer?.id ?? null, "pick_opened");
  }
  if (!viewer) {
    response.headers.append("set-cookie", `${FROM_PICK_COOKIE}=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
  }
  return response;
}

/** The owner ends a pick early: its pictures and votes are deleted straight away. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/picks/[code]">) {
  const viewer = await getCurrentUser(request).catch(() => null);
  if (!viewer) return NextResponse.json({ error: "Log in first." }, { status: 401, headers: noStore });
  const { code } = await ctx.params;
  const pick = await prisma.pick.findUnique({ where: { code }, select: { id: true, userId: true } });
  if (!pick || pick.userId !== viewer.id) return NextResponse.json({ error: "Pick not found." }, { status: 404, headers: noStore });
  await deletePicks([pick.id]);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
