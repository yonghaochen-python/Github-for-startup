import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/closet/items/[id]">) {
  const { id } = await ctx.params;
  await prisma.clothingItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
