import { NextResponse } from "next/server";
import { asResponse, isDevMode, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startTrial } from "@/lib/trial";

/**
 * LOCAL TESTING ONLY: starts (or moves the end of) the signed-in fake account's trial without Stripe, so the trial
 * rules can be tested. Answers "not found" everywhere except the local copy (the live app starts trials only from
 * Stripe's verified confirmation).
 * - POST { action: "start" }: starts the trial now.
 * - POST { action: "end" }: moves the end to now (as if 7 days had passed).
 */
export async function POST(request: Request) {
  if (!isDevMode()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (body.action === "start") return NextResponse.json(await startTrial(user.id));
  if (body.action === "end") {
    await prisma.user.update({ where: { id: user.id }, data: { trialEndsAt: new Date() } });
    return NextResponse.json({ ended: true });
  }
  return NextResponse.json({ error: "Choose start or end." }, { status: 400 });
}
