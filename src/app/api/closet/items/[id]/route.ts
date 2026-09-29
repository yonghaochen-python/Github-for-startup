import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function DELETE(request: Request, ctx: RouteContext<"/api/closet/items/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  await prisma.clothingItem.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
