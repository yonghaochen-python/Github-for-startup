import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

/** The signed-in person's plan, monthly period and photo/live balances (the same numbers the server uses), plus what this month's photo credits were used for. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const balances = await getBalances(user.id);
  // What this month's photo credits went on: try-ons or AI Stylist reports (only results actually made count;
  // reopening, downloading or sharing never uses a credit).
  const used = await prisma.creditEntry.findMany({
    where: { userId: user.id, kind: "photo", type: "use", status: "completed", createdAt: { gte: new Date(balances.period.start), lt: new Date(balances.period.end) } },
    select: { requestId: true },
  });
  const reports = used.filter((u) => u.requestId.startsWith("studio-")).length;
  return NextResponse.json(
    { balances: { ...balances, photoUsed: { tryOns: used.length - reports, reports } } },
    { headers: { "cache-control": "private, no-store" } }
  );
}
