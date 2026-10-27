import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustExtraCredits, getBalances, setPlan } from "@/lib/credits";
import { isPlanKey } from "@/lib/plans";

const noStore = { "cache-control": "private, no-store" };
// A live session still reserved after this long had no report: counted as "unclear".
const UNCLEAR_AFTER_MS = 2 * 60 * 1000;

/**
 * Admin: credit usage across everyone (photo and live, real users and admin tests kept apart), or one account's
 * balances and recent history with ?email=.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (email) {
    const account = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!account) return NextResponse.json({ error: "No account with that email." }, { status: 404, headers: noStore });
    const [balances, recent] = await Promise.all([
      getBalances(account.id),
      prisma.creditEntry.findMany({
        where: { userId: account.id },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { kind: true, type: true, source: true, amount: true, status: true, outcome: true, note: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ account: { email: account.email, admin: account.role === "admin" }, balances, recent }, { headers: noStore });
  }

  const groups = await prisma.creditEntry.groupBy({ by: ["kind", "status", "source"], where: { type: "use" }, _count: { _all: true } });
  const unclearLive = await prisma.creditEntry.count({
    where: { kind: "live", type: "use", status: "reserved", createdAt: { lt: new Date(Date.now() - UNCLEAR_AFTER_MS) } },
  });
  const count = (kind: string, status: string, admin: boolean) =>
    groups.filter((g) => g.kind === kind && g.status === status && (g.source === "admin") === admin).reduce((t, g) => t + g._count._all, 0);
  const overLimit = (kind: string) => groups.filter((g) => g.kind === kind && g.source === "over" && g.status !== "released").reduce((t, g) => t + g._count._all, 0);
  const summary = Object.fromEntries(
    (["photo", "live"] as const).map((kind) => [
      kind,
      {
        users: { completed: count(kind, "completed", false), released: count(kind, "released", false), reserved: count(kind, "reserved", false) },
        admin: { completed: count(kind, "completed", true), released: count(kind, "released", true), reserved: count(kind, "reserved", true) },
        overLimit: overLimit(kind),
      },
    ])
  );
  return NextResponse.json({ summary, unclearLive }, { headers: noStore });
}

/** Admin test tool (no billing yet): set an account's plan, or add/remove extra credits as an admin adjustment. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; action?: unknown; plan?: unknown; kind?: unknown; amount?: unknown; note?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const account = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
  if (!account) return NextResponse.json({ error: "No account with that email." }, { status: 404, headers: noStore });

  if (body.action === "setPlan") {
    if (!isPlanKey(body.plan)) return NextResponse.json({ error: "Unknown plan." }, { status: 400, headers: noStore });
    await setPlan(account.id, body.plan);
  } else if (body.action === "adjust") {
    const amount = Number(body.amount);
    if ((body.kind !== "photo" && body.kind !== "live") || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
      return NextResponse.json({ error: "Choose photo or live and a whole number between -500 and 500." }, { status: 400, headers: noStore });
    }
    await adjustExtraCredits(account.id, body.kind, amount, typeof body.note === "string" && body.note.trim() ? body.note.trim() : "Admin adjustment");
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ ok: true, balances: await getBalances(account.id) }, { headers: noStore });
}
