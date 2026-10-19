import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { maskEmail } from "@/lib/adminStats";

const noStore = { "cache-control": "private, no-store" };

/**
 * Minimal account list for the owner: masked email, sign-up date, last active date and how many pieces / outfits
 * the account has. No photos, clothing details or outfit content. Admins only.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: "admin" } },
      orderBy: { createdAt: "desc" },
      select: { email: true, createdAt: true, lastActiveAt: true, _count: { select: { items: true, outfits: true } } },
    });
    return NextResponse.json(
      {
        accounts: users.map((u) => ({
          email: maskEmail(u.email),
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt,
          closetItems: u._count.items,
          outfits: u._count.outfits,
        })),
      },
      { headers: noStore }
    );
  } catch (err) {
    console.error("Admin accounts failed:", err);
    return NextResponse.json({ error: "Couldn't load accounts right now." }, { status: 500, headers: noStore });
  }
}
