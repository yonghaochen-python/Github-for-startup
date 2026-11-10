import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingEnabled, portalUrl } from "@/lib/billing";

const noStore = { "cache-control": "private, no-store" };

/** Manage Plus: opens Stripe's own page for this person's billing (change card, invoices, cancel). */
export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (!row?.stripeCustomerId) return NextResponse.json({ error: "There's no billing to manage yet." }, { status: 404, headers: noStore });
  try {
    return NextResponse.json({ url: await portalUrl(row.stripeCustomerId, `${new URL(request.url).origin}/profile`) }, { headers: noStore });
  } catch (err) {
    console.error("Couldn't open the billing page:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't open your billing page right now. Please try again." }, { status: 502, headers: noStore });
  }
}
